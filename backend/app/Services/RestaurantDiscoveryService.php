<?php

namespace App\Services;

use App\Models\Restaurant;
use App\Repositories\Contracts\RestaurantDiscoveryRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class RestaurantDiscoveryService
{
    public function __construct(private readonly RestaurantDiscoveryRepository $restaurants) {}

    public function list(array $filters): LengthAwarePaginator
    {
        return $this->restaurants->restaurants($filters);
    }

    public function popular(int $limit, array $filters): Collection
    {
        return $this->restaurants->popular($limit, $filters);
    }

    public function categories(): Collection
    {
        return $this->restaurants->categories();
    }

    public function findPublic(int $restaurantId): ?Restaurant
    {
        return $this->restaurants->findPublic($restaurantId);
    }

    public function menu(Restaurant $restaurant, array $filters): array
    {
        return $this->restaurants->menu($restaurant, $filters);
    }

    public function reviews(Restaurant $restaurant, array $filters): LengthAwarePaginator
    {
        return $this->restaurants->reviews($restaurant, $filters);
    }
}
