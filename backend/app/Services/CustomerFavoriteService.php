<?php

namespace App\Services;

use App\Repositories\Contracts\CustomerFavoriteRepository;
use Illuminate\Support\Collection;

class CustomerFavoriteService
{
    public function __construct(private readonly CustomerFavoriteRepository $favorites) {}

    public function list(int $userId, ?string $type): Collection
    {
        return $this->favorites->listForUser($userId, $type);
    }

    public function favoriteRestaurant(int $userId, int $restaurantId): void
    {
        $this->favorites->favoriteRestaurant($userId, $restaurantId);
    }

    public function unfavoriteRestaurant(int $userId, int $restaurantId): void
    {
        $this->favorites->unfavoriteRestaurant($userId, $restaurantId);
    }

    public function favoriteMenuItem(int $userId, int $menuItemId): void
    {
        $this->favorites->favoriteMenuItem($userId, $menuItemId);
    }

    public function unfavoriteMenuItem(int $userId, int $menuItemId): void
    {
        $this->favorites->unfavoriteMenuItem($userId, $menuItemId);
    }
}
