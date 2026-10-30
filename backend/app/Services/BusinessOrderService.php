<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Restaurant;
use App\Models\User;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\OrderRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BusinessOrderService
{
    private const BUSINESS_TRANSITIONS = [
        'placed' => ['confirmed', 'rejected'],
        'confirmed' => ['preparing', 'cancelled'],
        'preparing' => ['ready', 'cancelled'],
        'ready' => ['completed', 'cancelled'],
    ];

    public function __construct(
        private readonly OrderRepository $orders,
        private readonly RestaurantPageRepository $restaurants,
        private readonly AuditLogRepository $audit,
    ) {}

    public function list(Restaurant $restaurant, array $filters, bool $includeActors): array
    {
        $orders = $this->orders->paginateForRestaurant($restaurant, $filters);

        return [
            'data' => $orders->getCollection()
                ->map(fn (Order $order): array => $this->orderArray($order, $includeActors))
                ->all(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
                'last_page' => $orders->lastPage(),
            ],
        ];
    }

    public function show(Restaurant $restaurant, int $orderId, bool $includeActors): array
    {
        $order = $this->orders->findForRestaurant($restaurant, $orderId);
        abort_unless($order instanceof Order, 404);

        return $this->orderArray($order, $includeActors);
    }

    public function transition(
        Restaurant $restaurant,
        User $actor,
        int $orderId,
        string $toStatus,
        ?string $reason,
        bool $includeActors,
    ): array {
        return DB::transaction(function () use ($restaurant, $actor, $orderId, $toStatus, $reason, $includeActors): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $order = $this->orders->findForRestaurant($lockedRestaurant, $orderId, true);
            abort_unless($order instanceof Order, 404);

            if (! in_array($toStatus, self::BUSINESS_TRANSITIONS[$order->status] ?? [], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This order cannot move from its current status to the requested status.'],
                ]);
            }
            if ($toStatus === 'completed' && $order->order_type !== 'pick_up') {
                throw ValidationException::withMessages([
                    'status' => ['Only a Pick-up order can be completed by the restaurant.'],
                ]);
            }
            if (in_array($toStatus, ['rejected', 'cancelled'], true) && trim((string) $reason) === '') {
                throw ValidationException::withMessages([
                    'reason' => ['A reason is required to reject or cancel an order.'],
                ]);
            }
            $normalizedReason = $reason === null || trim($reason) === '' ? null : trim($reason);
            if (in_array($toStatus, ['rejected', 'cancelled'], true)) {
                $this->orders->restoreStock($order);
            }

            $fromStatus = $order->status;
            $attributes = ['status' => $toStatus];
            if (in_array($toStatus, ['rejected', 'cancelled'], true)) {
                $attributes['cancelled_by'] = $actor->getKey();
                $attributes['cancel_reason'] = $normalizedReason;
            }
            if ($toStatus === 'completed') {
                $attributes['completed_at'] = now();
            }
            $order->forceFill($attributes)->save();
            $this->orders->recordStatus(
                $order,
                (int) $actor->getKey(),
                $fromStatus,
                $toStatus,
                $normalizedReason,
            );
            $this->audit->record([
                'actor_user_id' => $actor->getKey(),
                'restaurant_id' => $lockedRestaurant->getKey(),
                'action' => 'order.status.changed',
                'entity_type' => 'order',
                'entity_id' => (string) $order->getKey(),
                'before_value' => ['status' => $fromStatus],
                'after_value' => ['status' => $toStatus, 'reason' => $normalizedReason],
                'created_at' => now(),
            ]);

            $updated = $this->orders->findForRestaurant($lockedRestaurant, $orderId);
            abort_unless($updated instanceof Order, 404);

            return $this->orderArray($updated, $includeActors);
        });
    }

    public function autoCancelUnanswered(): int
    {
        $cutoff = now()->subMinutes(10);
        $orderIds = $this->orders->duePlacedOrders($cutoff);
        $cancelled = 0;
        foreach ($orderIds as $candidate) {
            $wasCancelled = DB::transaction(function () use ($candidate, $cutoff): bool {
                $restaurant = $this->restaurants->lockRestaurant((int) $candidate->restaurant_id);
                $lockedOrder = $this->orders->findForRestaurant($restaurant, (int) $candidate->getKey(), true);
                if (! $lockedOrder instanceof Order || $lockedOrder->status !== 'placed') {
                    return false;
                }
                if ($lockedOrder->placed_at->gt($cutoff)) {
                    return false;
                }

                $this->orders->restoreStock($lockedOrder);
                $lockedOrder->forceFill([
                    'status' => 'cancelled',
                    'cancel_reason' => 'Automatically cancelled after no restaurant response within 10 minutes.',
                ])->save();
                $this->orders->recordStatus(
                    $lockedOrder,
                    null,
                    'placed',
                    'cancelled',
                    $lockedOrder->cancel_reason,
                );

                return true;
            });
            $cancelled += $wasCancelled ? 1 : 0;
        }

        return $cancelled;
    }

    private function orderArray(Order $order, bool $includeActors): array
    {
        return [
            'id' => (string) $order->getKey(),
            'reference_code' => $order->reference_code,
            'order_type' => $order->order_type,
            'status' => $order->status,
            'placed_at' => $order->placed_at?->toISOString(),
            'scheduled_for' => $order->scheduled_for?->toISOString(),
            'recipient' => [
                'name' => $order->recipient_name,
                'phone' => $order->recipient_phone,
            ],
            'delivery' => $order->order_type === 'delivery' ? [
                'address' => $order->delivery_address_text,
                'latitude' => $order->delivery_lat,
                'longitude' => $order->delivery_lng,
            ] : null,
            'items' => $order->items->map(fn ($item): array => [
                'name' => $item->item_name_snapshot,
                'unit_price' => $item->unit_price_snapshot,
                'quantity' => $item->quantity,
                'note' => $item->note,
                'line_total' => number_format((float) $item->unit_price_snapshot * (int) $item->quantity, 2, '.', ''),
            ])->all(),
            'totals' => [
                'subtotal' => $order->subtotal,
                'delivery_fee' => $order->delivery_fee,
                'service_fee' => $order->service_fee,
                'discount_amount' => $order->discount_amount,
                'total' => $order->total_amount,
            ],
            'payment' => $order->payment ? [
                'method' => $order->payment->method,
                'status' => $order->payment->status,
            ] : null,
            'cancel_reason' => $order->cancel_reason,
            'status_history' => $order->statusHistory->map(fn ($entry): array => [
                'from_status' => $entry->from_status,
                'to_status' => $entry->to_status,
                'reason' => $entry->reason,
                'changed_at' => $entry->changed_at?->toISOString(),
                ...($includeActors ? ['actor' => $entry->actor ? [
                    'id' => (string) $entry->actor->getKey(),
                    'name' => $entry->actor->name,
                ] : null] : []),
            ])->all(),
        ];
    }
}
