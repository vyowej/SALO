<?php

namespace App\Repositories\Contracts;

use App\Models\Discount;
use App\Models\Restaurant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface BusinessDiscountRepository
{
    public function paginate(Restaurant $restaurant, array $filters): LengthAwarePaginator;

    public function lockForRestaurant(Restaurant $restaurant, int $discountId): ?Discount;

    public function create(Restaurant $restaurant, array $attributes): Discount;

    public function update(Discount $discount, array $attributes): Discount;
}
