<?php

namespace App\Repositories\Database;

use App\Models\DietaryTag;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Repositories\Contracts\MenuRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DatabaseMenuRepository implements MenuRepository
{
    public function categories(Restaurant $restaurant, bool $includeArchived = true): Collection
    {
        return $restaurant->menuCategories()
            ->when(! $includeArchived, fn (Builder $query) => $query->where('status', 'active'))
            ->withCount('items')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    public function items(Restaurant $restaurant, array $filters = []): Collection
    {
        return MenuItem::query()
            ->with(['category', 'dietaryTags'])
            ->whereHas('category', function (Builder $category) use ($restaurant, $filters): void {
                $category->where('restaurant_id', $restaurant->getKey());
                if (isset($filters['category_id'])) {
                    $category->whereKey($filters['category_id']);
                }
                if (! ($filters['include_archived_categories'] ?? false)) {
                    $category->where('status', 'active');
                }
            })
            ->when(isset($filters['status']), fn (Builder $query) => $query->where('lifecycle_status', $filters['status']))
            ->when(isset($filters['search']), function (Builder $query) use ($filters): void {
                $search = trim((string) $filters['search']);
                $query->where(function (Builder $items) use ($search): void {
                    $items->where('name', 'like', '%'.$search.'%')
                        ->orWhere('description', 'like', '%'.$search.'%');
                });
            })
            ->orderBy('category_id')
            ->orderBy('name')
            ->orderBy('id')
            ->get();
    }

    public function findCategory(Restaurant $restaurant, int $categoryId): ?MenuCategory
    {
        return $restaurant->menuCategories()->whereKey($categoryId)->first();
    }

    public function findItem(Restaurant $restaurant, int $itemId): ?MenuItem
    {
        return MenuItem::query()
            ->with(['category', 'dietaryTags'])
            ->whereKey($itemId)
            ->whereHas('category', fn (Builder $category) => $category->where('restaurant_id', $restaurant->getKey()))
            ->first();
    }

    public function createCategory(Restaurant $restaurant, array $attributes): MenuCategory
    {
        return $restaurant->menuCategories()->create($attributes);
    }

    public function updateCategory(MenuCategory $category, array $attributes): MenuCategory
    {
        $category->forceFill($attributes)->save();

        return $category->refresh()->loadCount('items');
    }

    public function createItem(MenuCategory $category, array $attributes, array $tagIds): MenuItem
    {
        $item = $category->items()->create($attributes);
        $item->dietaryTags()->sync($tagIds);

        return $item->load(['category', 'dietaryTags']);
    }

    public function updateItem(MenuItem $item, array $attributes, ?array $tagIds = null): MenuItem
    {
        $item->forceFill($attributes)->save();
        if ($tagIds !== null) {
            $item->dietaryTags()->sync($tagIds);
        }

        return $item->refresh()->load(['category', 'dietaryTags']);
    }

    public function availableTags(): Collection
    {
        return DietaryTag::query()->orderBy('tag_type')->orderBy('name')->get();
    }

    public function hasValidHalalCertificate(Restaurant $restaurant): bool
    {
        return DB::table('application_documents')
            ->join('restaurant_applications', 'restaurant_applications.id', '=', 'application_documents.application_id')
            ->where('restaurant_applications.restaurant_id', $restaurant->getKey())
            ->where('restaurant_applications.application_type', 'initial')
            ->where('restaurant_applications.status', 'approved')
            ->where('application_documents.doc_type', 'halal_certificate')
            ->where(function ($query): void {
                $query->whereNull('application_documents.expiry_date')
                    ->orWhereDate('application_documents.expiry_date', '>=', now('Asia/Manila')->toDateString());
            })
            ->exists();
    }

    public function hasOrderableItem(Restaurant $restaurant): bool
    {
        return MenuItem::query()
            ->where('lifecycle_status', 'published')
            ->where('is_available', true)
            ->where(function (Builder $query): void {
                $query->whereNull('daily_quantity')->orWhere('quantity_left', '>', 0);
            })
            ->whereHas('category', fn (Builder $category) => $category
                ->where('restaurant_id', $restaurant->getKey())
                ->where('status', 'active'))
            ->exists();
    }

    public function resetDailyQuantities(array $restaurantIds): int
    {
        if ($restaurantIds === []) {
            return 0;
        }

        $items = MenuItem::query()
            ->whereNotNull('daily_quantity')
            ->where('lifecycle_status', '!=', 'archived')
            ->whereHas('category', fn (Builder $category) => $category->whereIn('restaurant_id', $restaurantIds))
            ->get();
        foreach ($items as $item) {
            $item->forceFill(['quantity_left' => $item->daily_quantity])->save();
        }

        return $items->count();
    }
}
