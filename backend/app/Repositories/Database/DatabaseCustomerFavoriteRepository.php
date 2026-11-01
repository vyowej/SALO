<?php

namespace App\Repositories\Database;

use App\Repositories\Contracts\CustomerFavoriteRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DatabaseCustomerFavoriteRepository implements CustomerFavoriteRepository
{
    public function listForUser(int $userId, ?string $type): Collection
    {
        $favorites = collect();

        if ($type === null || $type === 'restaurant') {
            $favorites = $favorites->concat(
                DB::table('favorite_restaurants as favorites')
                    ->join('restaurants', 'restaurants.id', '=', 'favorites.restaurant_id')
                    ->where('favorites.user_id', $userId)
                    ->where('restaurants.status', 'approved')
                    ->where('restaurants.is_published', true)
                    ->whereNull('restaurants.deleted_at')
                    ->get([
                        'restaurants.id',
                        'restaurants.id as restaurant_id',
                        'restaurants.name',
                        'restaurants.cover_path as image_path',
                        'favorites.created_at',
                    ])
                    ->map(fn (object $favorite): array => [
                        'type' => 'restaurant',
                        'id' => (string) $favorite->id,
                        'restaurant_id' => (string) $favorite->restaurant_id,
                        'name' => $favorite->name,
                        'image_path' => $favorite->image_path,
                        'created_at' => $favorite->created_at,
                    ]),
            );
        }

        if ($type === null || $type === 'menu_item') {
            $favorites = $favorites->concat(
                DB::table('favorite_menu_items as favorites')
                    ->join('menu_items', 'menu_items.id', '=', 'favorites.item_id')
                    ->join('menu_categories', 'menu_categories.id', '=', 'menu_items.category_id')
                    ->join('restaurants', 'restaurants.id', '=', 'menu_categories.restaurant_id')
                    ->where('favorites.user_id', $userId)
                    ->where('menu_items.lifecycle_status', 'published')
                    ->where('menu_categories.status', 'active')
                    ->where('restaurants.status', 'approved')
                    ->where('restaurants.is_published', true)
                    ->whereNull('restaurants.deleted_at')
                    ->get([
                        'menu_items.id',
                        'restaurants.id as restaurant_id',
                        'menu_items.name',
                        'menu_items.image_path',
                        'favorites.created_at',
                    ])
                    ->map(fn (object $favorite): array => [
                        'type' => 'menu_item',
                        'id' => (string) $favorite->id,
                        'restaurant_id' => (string) $favorite->restaurant_id,
                        'name' => $favorite->name,
                        'image_path' => $favorite->image_path,
                        'created_at' => $favorite->created_at,
                    ]),
            );
        }

        return $favorites
            ->sortByDesc('created_at')
            ->values();
    }

    public function favoriteRestaurant(int $userId, int $restaurantId): void
    {
        DB::table('favorite_restaurants')->insertOrIgnore([
            'user_id' => $userId,
            'restaurant_id' => $restaurantId,
            'created_at' => now(),
        ]);
    }

    public function unfavoriteRestaurant(int $userId, int $restaurantId): void
    {
        DB::table('favorite_restaurants')
            ->where('user_id', $userId)
            ->where('restaurant_id', $restaurantId)
            ->delete();
    }

    public function favoriteMenuItem(int $userId, int $menuItemId): void
    {
        DB::table('favorite_menu_items')->insertOrIgnore([
            'user_id' => $userId,
            'item_id' => $menuItemId,
            'created_at' => now(),
        ]);
    }

    public function unfavoriteMenuItem(int $userId, int $menuItemId): void
    {
        DB::table('favorite_menu_items')
            ->where('user_id', $userId)
            ->where('item_id', $menuItemId)
            ->delete();
    }
}
