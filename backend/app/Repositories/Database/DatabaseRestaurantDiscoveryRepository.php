<?php

namespace App\Repositories\Database;

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Repositories\Contracts\RestaurantDiscoveryRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class DatabaseRestaurantDiscoveryRepository implements RestaurantDiscoveryRepository
{
    public function restaurants(array $filters): LengthAwarePaginator
    {
        $paginator = $this->publicQuery($filters)
            ->paginate((int) ($filters['per_page'] ?? 12))
            ->withQueryString();
        $this->decorate($paginator->getCollection(), $filters);

        return $paginator;
    }

    public function popular(int $limit, array $filters): SupportCollection
    {
        $restaurants = $this->publicQuery([])
            ->whereHas('orders', fn (Builder $orders) => $orders->whereNotIn('status', ['cancelled', 'rejected']))
            ->orderByDesc('popularity_count')
            ->orderBy('restaurants.name')
            ->limit($limit)
            ->get();
        $this->decorate($restaurants, $filters);

        return $restaurants;
    }

    public function categories(): SupportCollection
    {
        return DB::table('cuisine_types')
            ->join('restaurant_cuisines', 'restaurant_cuisines.cuisine_id', '=', 'cuisine_types.id')
            ->join('restaurants', 'restaurants.id', '=', 'restaurant_cuisines.restaurant_id')
            ->where('restaurants.status', 'approved')
            ->where('restaurants.is_published', true)
            ->whereNull('restaurants.deleted_at')
            ->distinct()
            ->orderBy('cuisine_types.name')
            ->pluck('cuisine_types.name');
    }

    public function findPublic(int $restaurantId): ?Restaurant
    {
        $restaurant = $this->publicQuery([])
            ->with(['photos', 'operatingHours', 'closureDates', 'reservationSetting', 'location'])
            ->whereKey($restaurantId)
            ->first();
        if ($restaurant !== null) {
            $this->decorate(new EloquentCollection([$restaurant]), []);
        }

        return $restaurant;
    }

    public function menu(Restaurant $restaurant, array $filters): array
    {
        $categoriesQuery = $restaurant->menuCategories()
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->orderBy('id');

        if (isset($filters['category_id'])) {
            $category = $categoriesQuery->whereKey((int) $filters['category_id'])->first();
            abort_unless($category !== null, 404);
            $categories = new EloquentCollection([$category]);
        } else {
            $categories = $categoriesQuery->get();
        }

        $categoryIds = $categories->modelKeys();
        $itemsQuery = MenuItem::query()
            ->whereIn('category_id', $categoryIds)
            ->where('lifecycle_status', 'published')
            ->when(! empty($filters['q']), function (Builder $query) use ($filters): void {
                $term = trim((string) $filters['q']);
                $query->where(function (Builder $search) use ($term): void {
                    $search->where('name', 'like', '%'.$term.'%')
                        ->orWhere('description', 'like', '%'.$term.'%');
                });
            })
            ->orderBy('category_id')
            ->orderBy('name')
            ->orderBy('id');
        foreach ($filters['dietary'] ?? [] as $tag) {
            $this->whereMenuItemHasDietaryTag($itemsQuery, (string) $tag);
        }
        $items = $itemsQuery->get();
        $tagsByItem = $this->dietaryTagsFor($items->modelKeys());
        $itemsByCategory = $items->groupBy('category_id');

        return [
            'categories' => $categories->map(fn (MenuCategory $category): array => [
                'id' => (string) $category->getKey(),
                'name' => $category->name,
                'sort_order' => $category->sort_order,
                'items' => ($itemsByCategory->get($category->getKey()) ?? collect())
                    ->map(fn (MenuItem $item): array => $this->publicItem($item, $category, $tagsByItem))
                    ->values()
                    ->all(),
            ])->values()->all(),
        ];
    }

    public function reviews(Restaurant $restaurant, array $filters): LengthAwarePaginator
    {
        return DB::table('restaurant_reviews')
            ->join('orders', 'orders.id', '=', 'restaurant_reviews.order_id')
            ->where('orders.restaurant_id', $restaurant->getKey())
            ->where('restaurant_reviews.is_hidden', false)
            ->orderByDesc('restaurant_reviews.created_at')
            ->orderByDesc('restaurant_reviews.id')
            ->select([
                'restaurant_reviews.id',
                'restaurant_reviews.rating',
                'restaurant_reviews.comment',
                'restaurant_reviews.reply',
                'restaurant_reviews.replied_at',
                'restaurant_reviews.created_at',
            ])
            ->paginate((int) ($filters['per_page'] ?? 10))
            ->withQueryString();
    }

    private function publicQuery(array $filters): Builder
    {
        $query = Restaurant::query()
            ->select('restaurants.*')
            ->where('restaurants.status', 'approved')
            ->where('restaurants.is_published', true)
            ->with([
                'cuisines:id,name,is_filipino',
                'photos',
                'operatingHours',
                'closureDates',
                'reservationSetting',
                'location',
            ])
            ->withCount([
                'orders as popularity_count' => fn (Builder $orders) => $orders
                    ->whereNotIn('status', ['cancelled', 'rejected']),
            ]);

        if (Schema::hasTable('restaurant_reviews')) {
            $query->addSelect([
                'rating_average' => DB::table('restaurant_reviews')
                    ->join('orders', 'orders.id', '=', 'restaurant_reviews.order_id')
                    ->whereColumn('orders.restaurant_id', 'restaurants.id')
                    ->where('restaurant_reviews.is_hidden', false)
                    ->selectRaw('AVG(restaurant_reviews.rating)'),
                'rating_count' => DB::table('restaurant_reviews')
                    ->join('orders', 'orders.id', '=', 'restaurant_reviews.order_id')
                    ->whereColumn('orders.restaurant_id', 'restaurants.id')
                    ->where('restaurant_reviews.is_hidden', false)
                    ->selectRaw('COUNT(*)'),
            ]);
        }

        if (! empty($filters['q'])) {
            $term = trim((string) $filters['q']);
            $query->where(function (Builder $search) use ($term): void {
                $search->where('restaurants.name', 'like', '%'.$term.'%')
                    ->orWhereHas('cuisines', fn (Builder $cuisines) => $cuisines->where('name', 'like', '%'.$term.'%'))
                    ->orWhereHas('menuCategories', fn (Builder $categories) => $categories
                        ->where('menu_categories.status', 'active')
                        ->whereHas('items', fn (Builder $items) => $items
                            ->where('menu_items.lifecycle_status', 'published')
                            ->where('menu_items.name', 'like', '%'.$term.'%')));
            });
        }

        if (! empty($filters['cuisine'])) {
            $query->whereHas('cuisines', fn (Builder $cuisines) => $cuisines->where('name', $filters['cuisine']));
        }

        if (! empty($filters['filipino_only'])) {
            $query->whereHas('cuisines', fn (Builder $cuisines) => $cuisines->where('is_filipino', true));
        }

        if (! empty($filters['open_24_7'])) {
            $query->where('restaurants.is_24_7', true);
        }

        if (! empty($filters['accepts_reservations'])) {
            $query->whereHas('reservationSetting', fn (Builder $settings) => $settings->where('accepts_reservations', true));
        }

        if (! empty($filters['open_now'])) {
            $this->whereOpenNow($query);
        }

        foreach ($filters['dietary'] ?? [] as $tag) {
            $this->whereHasDietaryTag($query, (string) $tag);
        }

        if (! empty($filters['featured'])) {
            $query->whereHas('orders', fn (Builder $orders) => $orders->whereNotIn('status', ['cancelled', 'rejected']));
        }

        $this->applySort($query, $filters);

        return $query;
    }

    private function whereOpenNow(Builder $query): void
    {
        $now = now('Asia/Manila');
        $today = $now->dayOfWeekIso;
        $previousDay = $today === 1 ? 7 : $today - 1;
        $currentTime = $now->format('H:i:s');
        $todayDate = $now->toDateString();

        $query->whereDoesntHave('closureDates', fn (Builder $closures) => $closures->whereDate('closure_date', $todayDate))
            ->where(function (Builder $availability) use ($today, $previousDay, $currentTime): void {
                $availability->where('restaurants.is_24_7', true)
                        ->orWhereHas('operatingHours', function (Builder $shifts) use ($today, $previousDay, $currentTime): void {
                            $shifts->where(function (Builder $day) use ($today, $previousDay, $currentTime): void {
                                $day->where(function (Builder $todayShift) use ($today, $currentTime): void {
                                    $todayShift->where('weekday', $today)
                                        ->where(function (Builder $time) use ($currentTime): void {
                                            $time->where(function (Builder $regular) use ($currentTime): void {
                                            $regular->where('crosses_midnight', false)
                                                ->where('open_time', '<=', $currentTime)
                                                ->where('close_time', '>', $currentTime);
                                        })->orWhere(function (Builder $overnight) use ($currentTime): void {
                                            $overnight->where('crosses_midnight', true)
                                                    ->where(function (Builder $within) use ($currentTime): void {
                                                        $within->where('open_time', '<=', $currentTime)
                                                        ->orWhere('close_time', '>', $currentTime);
                                                });
                                        });
                                    });
                                })->orWhere(function (Builder $previousShift) use ($previousDay, $currentTime): void {
                                    $previousShift->where('weekday', $previousDay)
                                        ->where('crosses_midnight', true)
                                        ->where('close_time', '>', $currentTime);
                                });
                            });
                        });
                });
    }

    private function whereHasDietaryTag(Builder $query, string $tag): void
    {
        $pivotTable = 'menu_item_dietary_tags';
        if (! Schema::hasTable($pivotTable) || ! Schema::hasTable('dietary_tags')) {
            $query->whereRaw('1 = 0');
            return;
        }

        $query->whereHas('menuCategories', function (Builder $categories) use ($tag, $pivotTable): void {
            $categories->where('menu_categories.status', 'active')
                ->whereHas('items', function (Builder $items) use ($tag, $pivotTable): void {
                    $items->where('menu_items.lifecycle_status', 'published')
                        ->whereExists(function ($subquery) use ($tag, $pivotTable): void {
                            $subquery->selectRaw('1')
                                ->from($pivotTable.' as item_tags')
                                ->join('dietary_tags as tags', 'tags.id', '=', 'item_tags.tag_id')
                                ->whereColumn('item_tags.item_id', 'menu_items.id')
                                ->where('tags.name', $tag);
                        });
                });
        });
    }

    private function whereMenuItemHasDietaryTag(Builder $items, string $tag): void
    {
        $pivotTable = 'menu_item_dietary_tags';
        if (! Schema::hasTable($pivotTable) || ! Schema::hasTable('dietary_tags')) {
            $items->whereRaw('1 = 0');
            return;
        }

        $items->whereExists(function ($subquery) use ($tag, $pivotTable): void {
            $subquery->selectRaw('1')
                ->from($pivotTable.' as item_tags')
                ->join('dietary_tags as tags', 'tags.id', '=', 'item_tags.tag_id')
                ->whereColumn('item_tags.item_id', 'menu_items.id')
                ->where('tags.name', $tag);
        });
    }

    private function applySort(Builder $query, array $filters): void
    {
        $sort = $filters['sort'] ?? 'popularity';
        if ($sort === 'nearest' && isset($filters['latitude'], $filters['longitude'])) {
            $latitude = (float) $filters['latitude'];
            $longitude = (float) $filters['longitude'];
            $longitudeScale = cos(deg2rad($latitude));
            $query->orderByRaw(
                '((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?) * ?) ASC',
                [$latitude, $latitude, $longitude, $longitude, $longitudeScale * $longitudeScale],
            );
        } elseif ($sort === 'rating' && Schema::hasTable('restaurant_reviews')) {
            $query->orderByDesc('rating_average');
        } else {
            $query->orderByDesc('popularity_count');
        }

        $query->orderBy('restaurants.name');
    }

    private function decorate(SupportCollection $restaurants, array $filters): void
    {
        if ($restaurants->isEmpty()) {
            return;
        }

        $restaurantIds = $restaurants->modelKeys();
        $itemIds = MenuItem::query()
            ->where('lifecycle_status', 'published')
            ->whereHas('category', fn (Builder $categories) => $categories
                ->where('status', 'active')
                ->whereIn('restaurant_id', $restaurantIds))
            ->pluck('id')
            ->all();
        $tagsByItem = $this->dietaryTagsFor($itemIds);
        $tagsByRestaurant = [];

        if ($tagsByItem !== []) {
            $categoryIdsByItem = MenuItem::query()
                ->whereIn('id', array_keys($tagsByItem))
                ->pluck('category_id', 'id');
            $restaurantIdsByCategory = MenuCategory::query()
                ->whereIn('id', $categoryIdsByItem->values()->unique())
                ->pluck('restaurant_id', 'id');

            foreach ($tagsByItem as $itemId => $tags) {
                $restaurantId = $restaurantIdsByCategory[$categoryIdsByItem[$itemId] ?? null] ?? null;
                if ($restaurantId === null) {
                    continue;
                }
                foreach ($tags as $tag) {
                    $tagsByRestaurant[$restaurantId][$tag['name']] = $this->tagLabel($tag['name']);
                }
            }
        }

        foreach ($restaurants as $restaurant) {
            $restaurant->setAttribute(
                'dietary_badges',
                array_values($tagsByRestaurant[$restaurant->getKey()] ?? []),
            );
            if (isset($filters['latitude'], $filters['longitude'])
                && $restaurant->latitude !== null && $restaurant->longitude !== null) {
                $restaurant->setAttribute('distance_km', $this->distanceKm(
                    (float) $filters['latitude'],
                    (float) $filters['longitude'],
                    (float) $restaurant->latitude,
                    (float) $restaurant->longitude,
                ));
            }
        }
    }

    private function tagLabel(string $tag): string
    {
        return match ($tag) {
            'halal_certified' => 'Halal Certified',
            'vegetarian' => 'Vegetarian',
            'vegan' => 'Vegan',
            'contains_pork' => 'Contains Pork',
            default => str_replace('_', ' ', ucfirst($tag)),
        };
    }

    private function distanceKm(float $latitude, float $longitude, float $targetLatitude, float $targetLongitude): float
    {
        $radians = static fn (float $degrees): float => deg2rad($degrees);
        $latitudeDelta = $radians($targetLatitude - $latitude);
        $longitudeDelta = $radians($targetLongitude - $longitude);
        $a = sin($latitudeDelta / 2) ** 2
            + cos($radians($latitude)) * cos($radians($targetLatitude))
            * sin($longitudeDelta / 2) ** 2;

        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function dietaryTagsFor(array $itemIds): array
    {
        if ($itemIds === [] || ! Schema::hasTable('menu_item_dietary_tags') || ! Schema::hasTable('dietary_tags')) {
            return [];
        }

        return DB::table('menu_item_dietary_tags as item_tags')
            ->join('dietary_tags as tags', 'tags.id', '=', 'item_tags.tag_id')
            ->whereIn('item_tags.item_id', $itemIds)
            ->orderBy('tags.name')
            ->get(['item_tags.item_id', 'tags.name', 'tags.tag_type'])
            ->groupBy('item_id')
            ->map(fn (SupportCollection $tags): array => $tags->map(fn ($tag): array => [
                'name' => $tag->name,
                'tag_type' => $tag->tag_type,
            ])->all())
            ->all();
    }

    private function publicItem(MenuItem $item, MenuCategory $category, array $tagsByItem): array
    {
        return [
            'id' => (string) $item->getKey(),
            'category_id' => (string) $category->getKey(),
            'category_name' => $category->name,
            'name' => $item->name,
            'description' => $item->description,
            'price' => $item->price,
            'image_url' => $this->publicUrl($item->image_path),
            'lifecycle_status' => $item->lifecycle_status,
            'is_available' => (bool) $item->is_available,
            'daily_quantity' => $item->daily_quantity,
            'quantity_left' => $item->quantity_left,
            'prep_minutes' => $item->prep_minutes,
            'is_orderable' => (bool) $item->is_available
                && ($item->daily_quantity === null || (int) $item->quantity_left > 0),
            'dietary_tags' => $tagsByItem[$item->getKey()] ?? [],
        ];
    }

    private function publicUrl(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        return preg_match('/^https?:\\/\\//i', $path) ? $path : Storage::disk('public')->url($path);
    }
}
