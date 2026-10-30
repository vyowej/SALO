<?php

namespace App\Repositories\Contracts;

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Restaurant;
use Illuminate\Support\Collection;

interface MenuRepository
{
    public function categories(Restaurant $restaurant, bool $includeArchived = true): Collection;

    public function items(Restaurant $restaurant, array $filters = []): Collection;

    public function findCategory(Restaurant $restaurant, int $categoryId): ?MenuCategory;

    public function findItem(Restaurant $restaurant, int $itemId): ?MenuItem;

    public function createCategory(Restaurant $restaurant, array $attributes): MenuCategory;

    public function updateCategory(MenuCategory $category, array $attributes): MenuCategory;

    public function createItem(MenuCategory $category, array $attributes, array $tagIds): MenuItem;

    public function updateItem(MenuItem $item, array $attributes, ?array $tagIds = null): MenuItem;

    public function availableTags(): Collection;

    public function hasValidHalalCertificate(Restaurant $restaurant): bool;

    public function hasOrderableItem(Restaurant $restaurant): bool;

    public function resetDailyQuantities(array $restaurantIds): int;
}
