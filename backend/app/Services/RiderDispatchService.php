<?php

namespace App\Services;

use App\Models\CustomerNotification;
use App\Models\Delivery;
use App\Models\DeliveryOffer;
use App\Models\Order;
use App\Models\PlatformAdmin;
use App\Models\RiderProfile;
use App\Models\User;
use App\Models\Zone;
use App\Repositories\Contracts\PlatformSettingsRepository;
use App\Repositories\Contracts\RiderDispatchRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use LogicException;
use Illuminate\Validation\ValidationException;

class RiderDispatchService
{
    private const ACTIVE_DELIVERY_STATUSES = ['offered', 'accepted', 'picked_up'];

    public function __construct(
        private readonly RiderDispatchRepository $dispatch,
        private readonly PlatformSettingsRepository $settings,
        private readonly RiderLocationCache $locations,
    ) {}

    public function home(User $user): array
    {
        $profile = $this->profileFor($user);
        $location = Cache::get($this->locationKey((int) $profile->getKey()));
        if ($profile->availability === 'online' && ! is_array($location)) {
            $this->forceOfflineForProfile((int) $profile->getKey(), 'Location expired');
            $profile->refresh();
        }

        $assignment = $this->currentShiftAssignments((int) $profile->getKey())
            ->with(['zone', 'shift'])
            ->orderBy('shift_id')
            ->first();

        $reason = match (true) {
            $profile->application_status !== 'approved' || $profile->status !== 'active'
                => 'Your rider profile is not active.',
            $assignment === null => 'You are not on an assigned shift right now.',
            ! is_array($location) && $profile->availability === 'online'
                => 'Your location expired. Go online again to refresh it.',
            default => null,
        };
        $activeDelivery = $this->dispatch->deliveries()
            ->where('rider_id', $profile->getKey())
            ->whereIn('status', self::ACTIVE_DELIVERY_STATUSES)
            ->orderByDesc('id')
            ->first();

        return [
            'availability' => $profile->availability,
            'can_go_online' => $reason === null && $activeDelivery === null,
            'disabled_reason' => $activeDelivery !== null
                ? 'Finish your current delivery before going online for another offer.'
                : $reason,
            'assignment' => $assignment === null ? null : [
                'zone' => $assignment->zone?->name,
                'shift' => $assignment->shift?->name,
                'start_time' => substr((string) $assignment->shift?->start_time, 0, 5),
                'end_time' => substr((string) $assignment->shift?->end_time, 0, 5),
            ],
            'next_action' => $activeDelivery !== null
                ? 'Continue your current delivery.'
                : ($profile->availability === 'online' ? 'Wait for a delivery offer.' : 'Go online during an assigned shift.'),
        ];
    }

    public function setAvailability(User $user, string $availability, ?float $latitude, ?float $longitude): array
    {
        $profileId = (int) $this->profileFor($user)->getKey();
        if ($availability === 'offline') {
            $this->forceOfflineForProfile($profileId, 'Rider went offline');

            return $this->home($user);
        }

        if ($latitude === null || $longitude === null) {
            throw ValidationException::withMessages([
                'location' => ['A current location is required to go online.'],
            ]);
        }

        DB::transaction(function () use ($profileId, $latitude, $longitude): void {
            $profile = $this->dispatch->profiles()->whereKey($profileId)->lockForUpdate()->firstOrFail();
            $this->assertProfileCanOperate($profile);
            if ($this->hasActiveDelivery($profileId)) {
                throw ValidationException::withMessages([
                    'availability' => ['Finish your current delivery before going online for another offer.'],
                ]);
            }
            if (! $this->hasCurrentShiftAssignment($profileId)) {
                throw ValidationException::withMessages([
                    'availability' => ['You can go online only during an assigned shift.'],
                ]);
            }

            $profile->forceFill(['availability' => 'online'])->save();
            Cache::put($this->locationKey($profileId), [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'updated_at' => now()->toIso8601String(),
            ], now()->addMinutes(2));
        });

        $this->dispatchReadyOrders();

        return $this->home($user);
    }

    public function currentFor(User $user): ?array
    {
        $profile = $this->profileFor($user);
        $profileId = (int) $profile->getKey();
        $delivery = $this->dispatch->deliveries()
            ->with(['order.restaurant', 'order.deliveryAddress.location.parent'])
            ->where('rider_id', $profileId)
            ->whereIn('status', ['offered', 'accepted', 'picked_up'])
            ->orderByDesc('id')
            ->first();

        if ($delivery === null) {
            return null;
        }

        $order = $delivery->order;
        if ($delivery->status === 'offered') {
            $offer = $delivery->offers()
                ->where('rider_id', $profileId)
                ->whereNull('response')
                ->orderByDesc('offered_at')
                ->first();
            if ($offer === null) {
                return null;
            }
            if ($this->offerExpired($offer)) {
                $this->expireOffer((int) $offer->getKey());

                return $this->currentFor($user);
            }

            return [
                'type' => 'offer',
                'offer' => [
                    'id' => (string) $offer->getKey(),
                    'delivery_id' => (string) $delivery->getKey(),
                    'reference_code' => $order->reference_code,
                    'pickup_name' => $order->restaurant?->name,
                    'pickup_distance_km' => $this->distanceFromCachedLocation(
                        $profileId,
                        $order->restaurant?->latitude,
                        $order->restaurant?->longitude,
                    ),
                    'dropoff_area' => $this->dropoffArea($order),
                    'estimated_earning' => $this->estimatedEarning($order),
                    'expires_at' => $offer->offered_at->copy()->addSeconds($this->ackSeconds())->toISOString(),
                    'ack_seconds' => $this->ackSeconds(),
                ],
            ];
        }

        return [
            'type' => 'active_delivery',
            'delivery' => [
                'id' => (string) $delivery->getKey(),
                'status' => $delivery->status,
                'reference_code' => $order->reference_code,
                'pickup' => [
                    'name' => $order->restaurant?->name,
                    'address' => $order->restaurant?->formatted_address,
                ],
                'customer' => [
                    'name' => $order->recipient_name,
                    'phone' => $order->recipient_phone,
                    'address' => $order->delivery_address_text,
                    'delivery_note' => $order->deliveryAddress?->delivery_note,
                ],
                'destination' => [
                    'latitude' => $order->delivery_lat,
                    'longitude' => $order->delivery_lng,
                ],
                'location' => $this->locations->latest($delivery, $profileId),
                'items' => $order->items()->get()->map(fn ($item): array => [
                    'name' => $item->item_name_snapshot,
                    'quantity' => (int) $item->quantity,
                    'note' => $item->note,
                ])->values()->all(),
            ],
        ];
    }

    public function updateDeliveryLocation(
        User $user,
        int $deliveryId,
        float $latitude,
        float $longitude,
    ): array {
        $profileId = (int) $this->profileFor($user)->getKey();

        return DB::transaction(function () use ($profileId, $deliveryId, $latitude, $longitude): array {
            $profile = $this->dispatch->profiles()->with('user')->whereKey($profileId)->lockForUpdate()->firstOrFail();
            $delivery = $this->dispatch->deliveries()->whereKey($deliveryId)->lockForUpdate()->first();
            abort_unless(
                $delivery !== null
                    && (int) $delivery->rider_id === $profileId
                    && in_array($delivery->status, ['accepted', 'picked_up'], true),
                404,
            );

            if ($profile->application_status !== 'approved'
                || $profile->status !== 'active'
                || $profile->availability !== 'busy'
                || $profile->user?->status !== 'active') {
                $this->locations->forgetProfile($profileId);
                abort(403);
            }

            return $this->locations->store($delivery, $profileId, $latitude, $longitude);
        }, 3);
    }

    public function clearDeliveryLocation(User $user, int $deliveryId): void
    {
        $profileId = (int) $this->profileFor($user)->getKey();
        $delivery = $this->dispatch->deliveries()->whereKey($deliveryId)->first();
        abort_unless($delivery !== null && (int) $delivery->rider_id === $profileId, 404);

        $this->locations->forgetForRider($profileId, $delivery);
    }

    public function respondToOffer(User $user, int $offerId, bool $accept): array
    {
        $profileId = (int) $this->profileFor($user)->getKey();
        $reference = $this->dispatch->offers()
            ->with('delivery')
            ->whereKey($offerId)
            ->where('rider_id', $profileId)
            ->firstOrFail();
        $orderId = (int) $reference->delivery->order_id;
        $result = DB::transaction(function () use ($profileId, $offerId, $orderId, $accept): array {
            $order = $this->dispatch->orders()->whereKey($orderId)->lockForUpdate()->firstOrFail();
            $delivery = $this->dispatch->deliveries()
                ->where('order_id', $orderId)
                ->lockForUpdate()
                ->firstOrFail();
            $offer = $this->dispatch->offers()
                ->whereKey($offerId)
                ->where('delivery_id', $delivery->getKey())
                ->where('rider_id', $profileId)
                ->lockForUpdate()
                ->firstOrFail();
            $profile = $this->dispatch->profiles()->whereKey($profileId)->lockForUpdate()->firstOrFail();

            if ($offer->response !== null
                || $delivery->status !== 'offered'
                || (int) $delivery->rider_id !== $profileId
                || $order->status !== 'ready') {
                return ['status' => 'unavailable', 'order_id' => $orderId];
            }
            if ($this->offerExpired($offer)) {
                $offer->forceFill(['response' => 'timeout', 'responded_at' => now()])->save();
                $delivery->forceFill([
                    'status' => 'offered',
                    'rider_id' => null,
                    'accepted_at' => null,
                ])->save();
                if (is_array(Cache::get($this->locationKey($profileId)))
                    && $this->profileIsEligibleForOrder($profile, $order)) {
                    $profile->forceFill(['availability' => 'online'])->save();
                } else {
                    $profile->forceFill(['availability' => 'offline'])->save();
                    $this->locations->forgetProfile($profileId);
                }

                return ['status' => 'expired', 'order_id' => $orderId];
            }
            if (! is_array(Cache::get($this->locationKey($profileId)))
                || ! $this->profileIsEligibleForOrder($profile, $order)) {
                $offer->forceFill(['response' => 'timeout', 'responded_at' => now()])->save();
                $delivery->forceFill([
                    'status' => 'offered',
                    'rider_id' => null,
                    'accepted_at' => null,
                ])->save();
                $profile->forceFill(['availability' => 'offline'])->save();
                $this->locations->forgetProfile($profileId);

                return ['status' => 'expired', 'order_id' => $orderId];
            }

            if (! $accept) {
                $offer->forceFill(['response' => 'declined', 'responded_at' => now()])->save();
                $delivery->forceFill(['rider_id' => null])->save();
                $profile->forceFill(['availability' => 'online'])->save();

                return ['status' => 'declined', 'order_id' => $orderId];
            }

            $offer->forceFill(['response' => 'accepted', 'responded_at' => now()])->save();
            $delivery->forceFill(['status' => 'accepted', 'accepted_at' => now()])->save();
            $profile->forceFill(['availability' => 'busy'])->save();

            return ['status' => 'accepted', 'order_id' => $orderId];
        }, 3);

        if (in_array($result['status'], ['declined', 'expired'], true)) {
            $this->dispatchReadyOrder($result['order_id']);
        }

        return ['status' => $result['status']];
    }

    public function dispatchReadyOrder(int $orderId): ?Delivery
    {
        $deliveryId = DB::transaction(function () use ($orderId): ?int {
            $order = $this->dispatch->orders()
                ->with(['restaurant', 'deliveryAddress.location.parent', 'checkoutGroup'])
                ->whereKey($orderId)
                ->lockForUpdate()
                ->first();
            if ($order === null || $order->status !== 'ready' || $order->order_type !== 'delivery') {
                return null;
            }
            if (! $order->payments()->where('method', 'cod')->exists()) {
                return null;
            }

            $delivery = $this->dispatch->deliveries()
                ->where('order_id', $orderId)
                ->lockForUpdate()
                ->first();
            if ($delivery !== null && ($delivery->status !== 'offered' || $delivery->rider_id !== null)) {
                return (int) $delivery->getKey();
            }
            if ($delivery === null) {
                $delivery = $this->dispatch->deliveries()->create([
                    'order_id' => $orderId,
                    'status' => 'offered',
                ]);
            }

            $zones = $this->orderedZonesFor($order);
            foreach ($zones as $zone) {
                $rider = $this->nearestEligibleRider($order, $zone, $delivery);
                if ($rider === null) {
                    continue;
                }

                $delivery->forceFill([
                    'rider_id' => $rider['profile']->getKey(),
                    'status' => 'offered',
                    'accepted_at' => null,
                ])->save();
                $offer = $delivery->offers()->create([
                    'rider_id' => $rider['profile']->getKey(),
                    'offered_at' => now(),
                ]);
                $this->notify(
                    (int) $rider['profile']->user_id,
                    'delivery_offer',
                    "New delivery offer for order {$order->reference_code}. Open Driver mode to respond.",
                    $order->reference_code,
                );

                return (int) $delivery->getKey();
            }

            $delivery->forceFill([
                'status' => 'offered',
                'rider_id' => null,
                'accepted_at' => null,
            ])->save();
            $this->notifyNoEligibleRider($order);

            return (int) $delivery->getKey();
        }, 3);

        return $deliveryId === null
            ? null
            : $this->dispatch->deliveries()->with(['order.restaurant', 'rider'])->find($deliveryId);
    }

    public function dispatchReadyOrders(): int
    {
        $orderIds = $this->dispatch->orders()
            ->where('status', 'ready')
            ->where('order_type', 'delivery')
            ->orderBy('placed_at')
            ->orderBy('id')
            ->pluck('id');
        $attempted = 0;
        foreach ($orderIds as $orderId) {
            $this->dispatchReadyOrder((int) $orderId);
            $attempted++;
        }

        return $attempted;
    }

    public function expireOffers(): int
    {
        $cutoff = now()->subSeconds($this->ackSeconds());
        $expired = $this->dispatch->offers()
            ->whereNull('response')
            ->where('offered_at', '<=', $cutoff)
            ->orderBy('offered_at')
            ->orderBy('id')
            ->pluck('id');
        $processed = 0;
        foreach ($expired as $offerId) {
            $processed += $this->expireOffer((int) $offerId) ? 1 : 0;
        }

        return $processed;
    }

    public function expireStaleLocations(): int
    {
        $staleProfileIds = $this->dispatch->profiles()
            ->whereIn('availability', ['online', 'busy'])
            ->orderBy('id')
            ->pluck('id');
        $expired = 0;
        foreach ($staleProfileIds as $profileId) {
            $profile = $this->dispatch->profiles()->with('user')->find($profileId);
            if ($profile !== null && (
                ! is_array(Cache::get($this->locationKey((int) $profileId)))
                || $profile->application_status !== 'approved'
                || $profile->status !== 'active'
                || $profile->user?->status !== 'active'
                || ! $this->hasCurrentShiftAssignment((int) $profileId)
            )) {
                $this->forceOfflineForProfile((int) $profileId, 'Rider is no longer eligible');
                $expired++;
            }
        }

        return $expired;
    }

    public function forceOfflineForUser(int $userId, string $reason): void
    {
        $profileId = $this->dispatch->profiles()->where('user_id', $userId)->value('id');
        if ($profileId !== null) {
            $this->forceOfflineForProfile((int) $profileId, $reason);
        }
    }

    public function forceOfflineForProfile(int $profileId, string $reason): void
    {
        $activeDelivery = $this->dispatch->deliveries()
            ->where('rider_id', $profileId)
            ->whereIn('status', ['offered', 'accepted'])
            ->first();
        $orderId = $activeDelivery?->order_id;

        if ($orderId !== null) {
            DB::transaction(function () use ($profileId, $orderId, $reason): void {
                $order = $this->dispatch->orders()->whereKey($orderId)->lockForUpdate()->first();
                $delivery = $this->dispatch->deliveries()
                    ->where('order_id', $orderId)
                    ->lockForUpdate()
                    ->first();
                $profile = $this->dispatch->profiles()->whereKey($profileId)->lockForUpdate()->first();
                if ($profile === null) {
                    return;
                }
                $profile->forceFill(['availability' => 'offline'])->save();
                $this->locations->forgetProfile($profileId);
                if ($order === null || $delivery === null || $order->status !== 'ready'
                    || ! in_array($delivery->status, ['offered', 'accepted'], true)
                    || (int) $delivery->rider_id !== $profileId) {
                    return;
                }

                $pendingOffer = $delivery->offers()
                    ->where('rider_id', $profileId)
                    ->whereNull('response')
                    ->lockForUpdate()
                    ->first();
                if ($pendingOffer !== null) {
                    $pendingOffer->forceFill(['response' => 'timeout', 'responded_at' => now()])->save();
                }
                $delivery->forceFill([
                    'status' => 'offered',
                    'rider_id' => null,
                    'accepted_at' => null,
                ])->save();
                $this->notify(
                    (int) $profile->user_id,
                    'delivery_offer_unavailable',
                    "The offer for order {$order->reference_code} was reassigned because {$reason}.",
                    $order->reference_code,
                );
            }, 3);
            $this->dispatchReadyOrder((int) $orderId);

            return;
        }

        DB::transaction(function () use ($profileId): void {
            $profile = $this->dispatch->profiles()->whereKey($profileId)->lockForUpdate()->first();
            if ($profile !== null) {
                $profile->forceFill(['availability' => 'offline'])->save();
            }
            $this->locations->forgetProfile($profileId);
        });
    }

    public function cancelForOrder(int $orderId): void
    {
        $delivery = $this->dispatch->deliveries()->where('order_id', $orderId)->first();
        if ($delivery === null) {
            return;
        }

        $profileId = $delivery->rider_id === null ? null : (int) $delivery->rider_id;
        if ($profileId !== null) {
            $this->locations->forgetForRider($profileId, $delivery);
        }
        $delivery->offers()
            ->whereNull('response')
            ->update(['response' => 'timeout', 'responded_at' => now()]);
        $delivery->forceFill(['status' => 'cancelled', 'rider_id' => null])->save();
        if ($profileId !== null) {
            $profile = $this->dispatch->profiles()->whereKey($profileId)->first();
            if ($profile !== null && $profile->status === 'active'
                && is_array(Cache::get($this->locationKey($profileId)))
                && ! $this->hasActiveDelivery($profileId)) {
                $profile->forceFill(['availability' => 'online'])->save();
            }
            $this->notify(
                (int) $profile?->user_id,
                'delivery_cancelled',
                'The assigned order was cancelled.',
                $delivery->order?->reference_code,
            );
        }
    }

    private function expireOffer(int $offerId): bool
    {
        $reference = $this->dispatch->offers()->with('delivery')->find($offerId);
        if ($reference === null) {
            return false;
        }
        $orderId = (int) $reference->delivery->order_id;
        $profileId = (int) $reference->rider_id;
        $expired = DB::transaction(function () use ($offerId, $orderId, $profileId): bool {
            $order = $this->dispatch->orders()->whereKey($orderId)->lockForUpdate()->first();
            $delivery = $this->dispatch->deliveries()->where('order_id', $orderId)->lockForUpdate()->first();
            $offer = $this->dispatch->offers()->whereKey($offerId)->lockForUpdate()->first();
            if ($order === null || $delivery === null || $offer === null
                || $offer->response !== null
                || (int) $delivery->rider_id !== $profileId
                || $delivery->status !== 'offered'
                || ! $this->offerExpired($offer)) {
                return false;
            }
            $offer->forceFill(['response' => 'timeout', 'responded_at' => now()])->save();
            $delivery->forceFill(['rider_id' => null])->save();
            $profile = $this->dispatch->profiles()->whereKey($profileId)->lockForUpdate()->first();
            if ($profile !== null && $profile->status === 'active'
                && is_array(Cache::get($this->locationKey($profileId)))
                && $this->hasCurrentShiftAssignment($profileId)
                && ! $this->hasActiveDelivery($profileId, (int) $delivery->getKey())) {
                $profile->forceFill(['availability' => 'online'])->save();
            } elseif ($profile !== null) {
                $profile->forceFill(['availability' => 'offline'])->save();
                $this->locations->forgetProfile($profileId);
            }

            return $order->status === 'ready';
        }, 3);

        if ($expired) {
            $this->dispatchReadyOrder($orderId);
        }

        return $expired;
    }

    private function nearestEligibleRider(Order $order, Zone $zone, Delivery $delivery): ?array
    {
        $time = $this->currentManilaShiftTime();
        $riderIds = $this->dispatch->assignments()
            ->where('zone_id', $zone->getKey())
            ->where('status', 'assigned')
            ->whereHas('shift', fn (Builder $query) => $this->whereShiftIsActiveAt($query, $time))
            ->whereHas('rider', fn ($query) => $query
                ->where('application_status', 'approved')
                ->where('status', 'active')
                ->where('availability', 'online')
                ->whereHas('user', fn ($user) => $user->where('status', 'active')))
            ->whereDoesntHave('rider.deliveries', fn ($query) => $query
                ->whereIn('status', self::ACTIVE_DELIVERY_STATUSES))
            ->whereDoesntHave('rider.deliveryOffers', fn ($query) => $query
                ->where('delivery_id', $delivery->getKey()))
            ->pluck('rider_id')
            ->unique()
            ->sort()
            ->values();
        if ($riderIds->isEmpty()) {
            return null;
        }

        $profiles = $this->dispatch->profiles()
            ->with('user')
            ->whereIn('id', $riderIds)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
        $candidates = [];
        foreach ($profiles as $profile) {
            if (! $this->profileIsEligibleForOrder($profile, $order, (int) $zone->getKey())
                || $this->hasActiveDelivery((int) $profile->getKey())
                || $this->dispatch->offers()
                    ->where('delivery_id', $delivery->getKey())
                    ->where('rider_id', $profile->getKey())
                    ->exists()) {
                continue;
            }
            $location = Cache::get($this->locationKey((int) $profile->getKey()));
            if (! is_array($location)
                || ! isset($location['latitude'], $location['longitude'])) {
                $profile->forceFill(['availability' => 'offline'])->save();
                continue;
            }
            $candidates[] = [
                'profile' => $profile,
                'distance' => $this->distanceKm(
                    (float) $location['latitude'],
                    (float) $location['longitude'],
                    (float) $order->restaurant->latitude,
                    (float) $order->restaurant->longitude,
                ),
            ];
        }
        usort($candidates, fn (array $left, array $right): int =>
            ($left['distance'] <=> $right['distance'])
                ?: ((int) $left['profile']->getKey() <=> (int) $right['profile']->getKey()));

        return $candidates[0] ?? null;
    }

    private function profileIsEligibleForOrder(RiderProfile $profile, Order $order, ?int $zoneId = null): bool
    {
        if ($order->status !== 'ready'
            || $order->order_type !== 'delivery'
            || $order->restaurant === null
            || ! is_numeric($order->restaurant->latitude)
            || ! is_numeric($order->restaurant->longitude)
            || $profile->application_status !== 'approved'
            || $profile->status !== 'active'
            || $profile->user?->status !== 'active'
            || $profile->availability !== 'online') {
            return false;
        }

        $zoneIds = $zoneId === null
            ? $this->orderedZonesFor($order)->pluck('id')
            : collect([$zoneId]);
        $time = $this->currentManilaShiftTime();

        return $this->dispatch->assignments()
            ->where('rider_id', $profile->getKey())
            ->where('status', 'assigned')
            ->whereIn('zone_id', $zoneIds)
            ->whereHas('zone', fn ($query) => $query->where('is_active', true))
            ->whereHas('shift', fn (Builder $query) => $this->whereShiftIsActiveAt($query, $time))
            ->exists();
    }

    private function orderedZonesFor(Order $order)
    {
        $zones = $this->dispatch->zones()->where('is_active', true)->orderBy('id')->get();
        if ($zones->isEmpty()) {
            return $zones;
        }
        $restaurant = $order->restaurant;
        $hasCoordinates = is_numeric($restaurant?->latitude) && is_numeric($restaurant?->longitude);
        $distance = fn (Zone $zone): float => $hasCoordinates
            ? $this->distanceKm(
                (float) $restaurant->latitude,
                (float) $restaurant->longitude,
                (float) $zone->center_lat,
                (float) $zone->center_lng,
            )
            : INF;
        $matches = $zones->filter(fn (Zone $zone): bool =>
            $restaurant?->psgc_code !== null && $zone->psgc_code === $restaurant->psgc_code);
        if ($matches->isEmpty() && $hasCoordinates) {
            $matches = $zones->filter(fn (Zone $zone): bool =>
                $distance($zone) <= (float) $zone->radius_km);
        }
        $primary = $matches->sort(function (Zone $left, Zone $right) use ($distance): int {
            return ($distance($left) <=> $distance($right))
                ?: ((int) $left->getKey() <=> (int) $right->getKey());
        })->first();
        $ordered = $zones->reject(fn (Zone $zone): bool =>
            $primary !== null && (int) $zone->getKey() === (int) $primary->getKey());
        $reference = $primary;
        if ($reference !== null && ! $hasCoordinates) {
            $ordered = $ordered->sort(fn (Zone $left, Zone $right): int =>
                ($this->distanceKm(
                    (float) $reference->center_lat,
                    (float) $reference->center_lng,
                    (float) $left->center_lat,
                    (float) $left->center_lng,
                ) <=> $this->distanceKm(
                    (float) $reference->center_lat,
                    (float) $reference->center_lng,
                    (float) $right->center_lat,
                    (float) $right->center_lng,
                )) ?: ((int) $left->getKey() <=> (int) $right->getKey()));
        } else {
            $ordered = $ordered->sort(fn (Zone $left, Zone $right): int =>
                ($distance($left) <=> $distance($right))
                    ?: ((int) $left->getKey() <=> (int) $right->getKey()));
        }

        return $primary === null ? $ordered->values() : collect([$primary])->concat($ordered)->values();
    }

    private function hasCurrentShiftAssignment(int $profileId): bool
    {
        return $this->currentShiftAssignments($profileId)->exists();
    }

    private function currentShiftAssignments(int $profileId): Builder
    {
        $time = $this->currentManilaShiftTime();

        return $this->dispatch->assignments()
            ->where('rider_id', $profileId)
            ->where('status', 'assigned')
            ->whereHas('zone', fn ($query) => $query->where('is_active', true))
            ->whereHas('shift', fn (Builder $query) => $this->whereShiftIsActiveAt($query, $time));
    }

    private function currentManilaShiftTime(): string
    {
        return now('Asia/Manila')->format('H:i:s');
    }

    private function whereShiftIsActiveAt(Builder $query, string $time): Builder
    {
        return $query->where(function (Builder $query) use ($time): void {
            $query->where(function (Builder $query) use ($time): void {
                $query->whereColumn('start_time', '<=', 'end_time')
                    ->where('start_time', '<=', $time)
                    ->where('end_time', '>', $time);
            })->orWhere(function (Builder $query) use ($time): void {
                $query->whereColumn('start_time', '>', 'end_time')
                    ->where(function (Builder $query) use ($time): void {
                        $query->where('start_time', '<=', $time)
                            ->orWhere('end_time', '>', $time);
                    });
            });
        });
    }

    private function hasActiveDelivery(int $profileId, ?int $exceptDeliveryId = null): bool
    {
        $query = $this->dispatch->deliveries()
            ->where('rider_id', $profileId)
            ->whereIn('status', self::ACTIVE_DELIVERY_STATUSES)
            ->when($exceptDeliveryId !== null, fn ($query) => $query->where('id', '<>', $exceptDeliveryId))
            ->orderBy('id');

        return $query->lockForUpdate()->first() !== null;
    }

    private function assertProfileCanOperate(RiderProfile $profile): void
    {
        if ($profile->application_status !== 'approved'
            || $profile->status !== 'active'
            || $profile->user?->status !== 'active') {
            throw ValidationException::withMessages([
                'availability' => ['Only an active, approved rider can go online.'],
            ]);
        }
    }

    private function profileFor(User $user): RiderProfile
    {
        return $this->dispatch->profiles()
            ->where('user_id', $user->getKey())
            ->firstOrFail();
    }

    private function offerExpired(DeliveryOffer $offer): bool
    {
        return $offer->offered_at->copy()->addSeconds($this->ackSeconds())->isPast();
    }

    private function ackSeconds(): int
    {
        $value = $this->settings->all()['rider_ack_seconds'] ?? null;
        if (! is_numeric($value) || (int) $value < 1) {
            throw new LogicException('The rider_ack_seconds platform setting must be a positive integer.');
        }

        return (int) $value;
    }

    private function estimatedEarning(Order $order): string
    {
        $share = $this->settings->all()['rider_share_percent'] ?? null;
        if (! is_numeric($share) || (float) $share < 0 || (float) $share > 100) {
            throw new LogicException('The rider_share_percent platform setting must be between 0 and 100.');
        }

        return number_format((float) $order->delivery_fee * (float) $share / 100, 2, '.', '');
    }

    private function dropoffArea(Order $order): string
    {
        $location = $order->deliveryAddress?->location;
        $parent = $location?->parent;
        $area = $parent?->name ?? $location?->name;

        return $area ?: 'Nearby area';
    }

    private function distanceFromCachedLocation(int $profileId, mixed $latitude, mixed $longitude): ?float
    {
        $location = Cache::get($this->locationKey($profileId));
        if (! is_array($location) || ! is_numeric($latitude) || ! is_numeric($longitude)) {
            return null;
        }

        return round($this->distanceKm(
            (float) $location['latitude'],
            (float) $location['longitude'],
            (float) $latitude,
            (float) $longitude,
        ), 1);
    }

    private function distanceKm(float $latitudeA, float $longitudeA, float $latitudeB, float $longitudeB): float
    {
        $latitudeDelta = deg2rad($latitudeB - $latitudeA);
        $longitudeDelta = deg2rad($longitudeB - $longitudeA);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($latitudeA)) * cos(deg2rad($latitudeB)) * sin($longitudeDelta / 2) ** 2;

        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function locationKey(int $profileId): string
    {
        return "rider:{$profileId}:dispatch-location";
    }

    private function notifyNoEligibleRider(Order $order): void
    {
        $recipients = collect([
            $order->checkoutGroup?->user_id,
            $order->restaurant?->owner_user_id,
        ])->filter()->map(fn ($id): int => (int) $id);
        $staffIds = $order->restaurant?->staff()
            ->where('status', 'active')
            ->pluck('user_id') ?? collect();
        $adminIds = PlatformAdmin::query()
            ->where('status', 'active')
            ->pluck('user_id');

        foreach ($recipients->concat($staffIds)->concat($adminIds)->unique() as $userId) {
            $this->notify(
                (int) $userId,
                'delivery_unassigned',
                "No eligible rider is available for order {$order->reference_code}. Dispatch will retry automatically.",
                $order->reference_code,
            );
        }
    }

    private function notify(int $userId, string $type, string $message, ?string $reference): void
    {
        if ($userId < 1 || $reference === null) {
            return;
        }
        CustomerNotification::query()->firstOrCreate(
            ['user_id' => $userId, 'type' => $type, 'related_reference' => $reference],
            ['message' => $message, 'created_at' => now()],
        );
    }
}
