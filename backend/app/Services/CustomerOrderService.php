<?php

namespace App\Services;

use App\Models\Order;
use App\Repositories\Contracts\CustomerOrderRepository;
use App\Repositories\Contracts\OrderRepository;
use App\Services\RiderLocationCache;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerOrderService
{
    public function __construct(
        private readonly CustomerOrderRepository $orders,
        private readonly OrderRepository $sharedOrders,
        private readonly RiderLocationCache $locations,
    ) {}

    public function list(int $userId, array $filters): LengthAwarePaginator
    {
        return $this->orders->paginateForCustomer($userId, $filters);
    }

    public function find(int $userId, int $orderId): Order
    {
        $order = $this->orders->findForCustomer($userId, $orderId);
        abort_unless($order instanceof Order, 404);

        return $order;
    }

    public function tracking(int $userId, int $orderId): array
    {
        $order = $this->find($userId, $orderId);
        $delivery = $order->delivery()->with('rider.user')->first();
        $activeDelivery = $delivery !== null
            && in_array($delivery->status, ['accepted', 'picked_up'], true)
            && $delivery->rider_id !== null;
        $rider = $delivery?->rider;
        $riderEligible = $activeDelivery
            && $rider !== null
            && $rider->application_status === 'approved'
            && $rider->status === 'active'
            && $rider->availability === 'busy'
            && $rider->user?->status === 'active';
        $liveLocation = $riderEligible
            ? $this->locations->latest($delivery, (int) $delivery->rider_id)
            : null;

        if ($delivery !== null && $delivery->rider_id !== null && ! $riderEligible) {
            $this->locations->forgetForRider((int) $delivery->rider_id, $delivery);
        }

        return [
            'order_id' => (string) $order->getKey(),
            'reference_code' => $order->reference_code,
            'status' => $order->status,
            'order_type' => $order->order_type,
            'timeline' => $order->statusHistory->map(fn ($entry): array => [
                'from_status' => $entry->from_status,
                'status' => $entry->to_status,
                'reason' => $entry->reason,
                'changed_at' => $entry->changed_at?->toISOString(),
            ])->values()->all(),
            'restaurant' => [
                'name' => $order->restaurant?->name,
                'address' => $order->restaurant?->formatted_address,
                'latitude' => $order->restaurant?->latitude,
                'longitude' => $order->restaurant?->longitude,
            ],
            'delivery' => $order->order_type === 'delivery' ? [
                'address' => $order->delivery_address_text,
                'latitude' => $order->delivery_lat,
                'longitude' => $order->delivery_lng,
            ] : null,
            'estimated_arrival_at' => null,
            'live_location' => $liveLocation,
            'live_location_unavailable' => $activeDelivery && $liveLocation === null,
        ];
    }

    public function cancel(int $userId, int $orderId, ?string $reason): Order
    {
        return DB::transaction(function () use ($userId, $orderId, $reason): Order {
            $order = $this->orders->findForCustomer($userId, $orderId, true);
            abort_unless($order instanceof Order, 404);

            if ($order->status !== 'placed') {
                throw ValidationException::withMessages([
                    'order' => ['Only a Placed order can be cancelled.'],
                ]);
            }

            $this->sharedOrders->restoreStock($order);
            $this->orders->releaseDiscountRedemptions($order);
            $fromStatus = $order->status;
            $normalizedReason = $reason === null || trim($reason) === '' ? null : trim($reason);
            $order->forceFill([
                'status' => 'cancelled',
                'cancelled_by_type' => 'customer',
                'cancelled_by_user_id' => $userId,
                'cancel_reason' => $normalizedReason,
            ])->save();
            $this->sharedOrders->recordStatus(
                $order,
                $userId,
                $fromStatus,
                'cancelled',
                $normalizedReason,
            );

            return $this->find($userId, $orderId);
        });
    }

    public function confirmReceipt(int $userId, int $orderId): Order
    {
        return DB::transaction(function () use ($userId, $orderId): Order {
            $order = $this->orders->findForCustomer($userId, $orderId, true);
            abort_unless($order instanceof Order, 404);

            if ($order->status !== 'delivered' || $order->customer_confirmed_at !== null) {
                throw ValidationException::withMessages([
                    'order' => ['Receipt can only be confirmed once for a Delivered order.'],
                ]);
            }

            $order->forceFill([
                'status' => 'completed',
                'completed_at' => now(),
                'customer_confirmed_at' => now(),
                'confirmation_method' => 'customer',
            ])->save();
            $this->sharedOrders->recordStatus($order, $userId, 'delivered', 'completed', null);

            return $this->find($userId, $orderId);
        });
    }

    public function reviewRestaurant(int $userId, int $orderId, int $rating, ?string $comment): Order
    {
        return DB::transaction(function () use ($userId, $orderId, $rating, $comment): Order {
            $order = $this->orders->findForCustomer($userId, $orderId, true);
            abort_unless($order instanceof Order, 404);

            if ($order->status !== 'completed' || $order->customer_confirmed_at === null) {
                throw ValidationException::withMessages([
                    'order' => ['A review is available after you confirm receipt of this order.'],
                ]);
            }
            if ($this->orders->isRestaurantMember($userId, (int) $order->restaurant_id)) {
                throw ValidationException::withMessages([
                    'order' => ['Restaurant owners and staff cannot review their own restaurant.'],
                ]);
            }
            if ($order->restaurantReview()->exists()) {
                throw ValidationException::withMessages([
                    'order' => ['A review has already been submitted for this order.'],
                ]);
            }

            $this->orders->createRestaurantReview([
                'order_id' => $order->getKey(),
                'user_id' => $userId,
                'rating' => $rating,
                'comment' => $comment === null ? null : trim($comment),
                'is_hidden' => false,
                'created_at' => now(),
            ]);

            return $this->find($userId, $orderId);
        });
    }
}
