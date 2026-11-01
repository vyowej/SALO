<?php

namespace App\Repositories\Contracts;

use App\Models\Order;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface CustomerOrderRepository
{
    public function paginateForCustomer(int $userId, array $filters): LengthAwarePaginator;

    public function findForCustomer(int $userId, int $orderId, bool $lock = false): ?Order;

    public function releaseDiscountRedemptions(Order $order): void;

    public function isRestaurantMember(int $userId, int $restaurantId): bool;

    public function createRestaurantReview(array $attributes): void;
}
