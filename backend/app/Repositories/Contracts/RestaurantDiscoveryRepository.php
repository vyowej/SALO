<?php

namespace App\Repositories\Contracts;

use App\Models\Restaurant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface RestaurantDiscoveryRepository
{
    public function restaurants(array $filters): LengthAwarePaginator;

    public function popular(int $limit, array $filters): Collection;

    public function categories(): Collection;

    public function findPublic(int $restaurantId): ?Restaurant;

    public function menu(Restaurant $restaurant, array $filters): array;

    public function reviews(Restaurant $restaurant, array $filters): LengthAwarePaginator;
}
