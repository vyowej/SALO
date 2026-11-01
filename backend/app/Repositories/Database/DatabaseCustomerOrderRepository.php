<?php

namespace App\Repositories\Database;

use App\Models\Order;
use App\Models\RestaurantReview;
use App\Repositories\Contracts\CustomerOrderRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class DatabaseCustomerOrderRepository implements CustomerOrderRepository
{
    public function paginateForCustomer(int $userId, array $filters): LengthAwarePaginator
    {
        return $this->customerOrders($userId)
            ->when(isset($filters['status']), fn (Builder $query) => $query->where('status', $filters['status']))
            ->when(isset($filters['from']), fn (Builder $query) => $query->whereDate('placed_at', '>=', $filters['from']))
            ->when(isset($filters['to']), fn (Builder $query) => $query->whereDate('placed_at', '<=', $filters['to']))
            ->orderByDesc('placed_at')
            ->orderByDesc('id')
            ->paginate(min(50, max(1, (int) ($filters['per_page'] ?? 15))));
    }

    public function findForCustomer(int $userId, int $orderId, bool $lock = false): ?Order
    {
        $query = $this->customerOrders($userId)->whereKey($orderId);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function releaseDiscountRedemptions(Order $order): void
    {
        $order->discountRedemptions()
            ->where('status', 'applied')
            ->update(['status' => 'released', 'updated_at' => now()]);
    }

    public function isRestaurantMember(int $userId, int $restaurantId): bool
    {
        return DB::table('restaurants')
            ->where('id', $restaurantId)
            ->where(function ($query) use ($userId): void {
                $query->where('owner_user_id', $userId)
                    ->orWhereExists(function ($staff) use ($userId): void {
                        $staff->selectRaw('1')
                            ->from('restaurant_staff')
                            ->whereColumn('restaurant_staff.restaurant_id', 'restaurants.id')
                            ->where('restaurant_staff.user_id', $userId)
                            ->where('restaurant_staff.status', 'active');
                    });
            })
            ->exists();
    }

    public function createRestaurantReview(array $attributes): void
    {
        RestaurantReview::query()->create($attributes);
    }

    private function customerOrders(int $userId): Builder
    {
        return Order::query()
            ->whereHas('checkoutGroup', fn (Builder $groups) => $groups->where('user_id', $userId))
            ->with([
                'checkoutGroup',
                'restaurant',
                'items',
                'payments',
                'statusHistory',
                'discountRedemptions',
                'restaurantReview',
            ]);
    }
}
