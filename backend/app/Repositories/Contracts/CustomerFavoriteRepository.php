<?php

namespace App\Repositories\Contracts;

use Illuminate\Support\Collection;

interface CustomerFavoriteRepository
{
    public function listForUser(int $userId, ?string $type): Collection;

    public function favoriteRestaurant(int $userId, int $restaurantId): void;

    public function unfavoriteRestaurant(int $userId, int $restaurantId): void;

    public function favoriteMenuItem(int $userId, int $menuItemId): void;

    public function unfavoriteMenuItem(int $userId, int $menuItemId): void;
}
