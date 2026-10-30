<?php

namespace App\Repositories\Database;

use App\Models\Discount;
use App\Models\Restaurant;
use App\Repositories\Contracts\BusinessDiscountRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class DatabaseBusinessDiscountRepository implements BusinessDiscountRepository
{
    public function paginate(Restaurant $restaurant, array $filters): LengthAwarePaginator
    {
        return Discount::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->withCount(['redemptions as usage_count' => fn (Builder $query) => $query->where('status', 'applied')])
            ->when(isset($filters['is_active']), fn (Builder $query) => $query->where('is_active', $filters['is_active']))
            ->when(isset($filters['search']), function (Builder $query) use ($filters): void {
                $search = trim((string) $filters['search']);
                $query->where(function (Builder $searchQuery) use ($search): void {
                    $searchQuery->where('code', 'like', '%'.$search.'%')
                        ->orWhere('name', 'like', '%'.$search.'%');
                });
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(min(100, max(1, (int) ($filters['per_page'] ?? 25))));
    }

    public function lockForRestaurant(Restaurant $restaurant, int $discountId): ?Discount
    {
        return Discount::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->whereKey($discountId)
            ->lockForUpdate()
            ->first();
    }

    public function create(Restaurant $restaurant, array $attributes): Discount
    {
        return $restaurant->discounts()->create($attributes);
    }

    public function update(Discount $discount, array $attributes): Discount
    {
        $discount->forceFill($attributes)->save();

        return $discount->refresh();
    }
}
