<?php

namespace App\Repositories\Database;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Restaurant;
use App\Repositories\Contracts\OrderRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class DatabaseOrderRepository implements OrderRepository
{
    public function paginateForRestaurant(Restaurant $restaurant, array $filters): LengthAwarePaginator
    {
        return Order::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->with(['items', 'payment', 'statusHistory.actor'])
            ->when(isset($filters['status']), fn (Builder $query) => $query->where('status', $filters['status']))
            ->when(isset($filters['from']), fn (Builder $query) => $query->whereDate('placed_at', '>=', $filters['from']))
            ->when(isset($filters['to']), fn (Builder $query) => $query->whereDate('placed_at', '<=', $filters['to']))
            ->when(isset($filters['search']), function (Builder $query) use ($filters): void {
                $search = trim((string) $filters['search']);
                $query->where(function (Builder $nested) use ($search): void {
                    $nested->where('reference_code', 'like', '%'.$search.'%')
                        ->orWhere('recipient_name', 'like', '%'.$search.'%');
                });
            })
            ->orderByDesc('placed_at')
            ->orderByDesc('id')
            ->paginate(min(100, max(1, (int) ($filters['per_page'] ?? 15))));
    }

    public function findForRestaurant(Restaurant $restaurant, int $orderId, bool $lock = false): ?Order
    {
        $query = Order::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->whereKey($orderId)
            ->with(['items', 'payment', 'statusHistory.actor']);

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function recordStatus(
        Order $order,
        ?int $actorUserId,
        ?string $fromStatus,
        string $toStatus,
        ?string $reason,
    ): void {
        $order->statusHistory()->create([
            'actor_user_id' => $actorUserId,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'reason' => $reason,
            'changed_at' => now(),
        ]);
    }

    public function restoreStock(Order $order): void
    {
        $quantities = $order->items
            ->groupBy('item_id')
            ->map(fn (Collection $items): int => (int) $items->sum('quantity'));

        foreach ($quantities as $itemId => $quantity) {
            $item = MenuItem::query()->lockForUpdate()->find($itemId);
            if ($item === null || $item->daily_quantity === null) {
                continue;
            }

            $currentQuantity = $item->quantity_left ?? 0;
            $item->forceFill([
                'quantity_left' => min($item->daily_quantity, $currentQuantity + $quantity),
            ])->save();
        }
    }

    public function duePlacedOrders(Carbon $cutoff): Collection
    {
        return Order::query()
            ->where('status', 'placed')
            ->where('placed_at', '<=', $cutoff)
            ->orderBy('placed_at')
            ->get(['id', 'restaurant_id']);
    }
}
