<?php

namespace App\Repositories\Contracts;

use App\Models\Order;
use App\Models\Restaurant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

interface OrderRepository
{
    public function paginateForRestaurant(Restaurant $restaurant, array $filters): LengthAwarePaginator;

    public function findForRestaurant(Restaurant $restaurant, int $orderId, bool $lock = false): ?Order;

    public function recordStatus(Order $order, ?int $actorUserId, ?string $fromStatus, string $toStatus, ?string $reason): void;

    public function restoreStock(Order $order): void;

    public function duePlacedOrders(Carbon $cutoff): Collection;
}
