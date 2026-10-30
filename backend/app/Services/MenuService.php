<?php

namespace App\Services;

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\RestaurantApplication;
use App\Models\User;
use App\Repositories\Contracts\ApplicationDocumentRepository;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\MenuRepository;
use App\Repositories\Contracts\RestaurantApplicationRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class MenuService
{
    public function __construct(
        private readonly MenuRepository $menus,
        private readonly RestaurantPageRepository $restaurants,
        private readonly RestaurantApplicationRepository $applications,
        private readonly ApplicationDocumentRepository $documents,
        private readonly AuditLogRepository $audit,
        private readonly PublicPhotoStorageService $publicPhotos,
        private readonly PrivateDocumentStorageService $privateFiles,
    ) {}

    public function index(Restaurant $restaurant, array $filters): array
    {
        $categoryFilters = $filters;
        $categoryFilters['include_archived_categories'] = (bool) ($filters['include_archived_categories'] ?? false)
            || ($filters['status'] ?? null) === 'archived';

        return [
            'categories' => $this->menus->categories($restaurant)->map(fn (MenuCategory $category): array => [
                'id' => (string) $category->getKey(),
                'name' => $category->name,
                'sort_order' => $category->sort_order,
                'status' => $category->status,
                'item_count' => $category->items_count,
            ])->all(),
            'items' => $this->menus->items($restaurant, $categoryFilters)
                ->map(fn (MenuItem $item): array => $this->itemArray($item))
                ->all(),
            'dietary_tags' => $this->menus->availableTags()->map(fn ($tag): array => [
                'id' => (string) $tag->getKey(),
                'name' => $tag->name,
                'tag_type' => $tag->tag_type,
            ])->all(),
            'halal_certificate_available' => $this->menus->hasValidHalalCertificate($restaurant),
        ];
    }

    public function createCategory(Restaurant $restaurant, User $actor, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $data): array {
            $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $category = $this->menus->createCategory($locked, [
                'name' => trim($data['name']),
                'sort_order' => $data['sort_order'] ?? 0,
                'status' => 'active',
            ]);
            $result = $this->categoryArray($category);
            $this->record($actor, $locked, 'menu.category.created', 'menu_category', (string) $category->getKey(), null, $result);

            return $result;
        });
    }

    public function updateCategory(Restaurant $restaurant, User $actor, int $categoryId, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $categoryId, $data): array {
            $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $category = $this->menus->findCategory($locked, $categoryId);
            abort_unless($category !== null, 404);
            $attributes = array_intersect_key($data, array_flip(['name', 'sort_order', 'status']));
            if (($attributes['status'] ?? null) === 'archived' && $category->status !== 'archived') {
                $hasPublishedItems = $this->menus->items($locked, [
                    'category_id' => $categoryId,
                    'status' => 'published',
                    'include_archived_categories' => true,
                ])->isNotEmpty();
                if ($hasPublishedItems) {
                    throw ValidationException::withMessages([
                        'status' => ['Archive or move all published items before archiving this category.'],
                    ]);
                }
            }
            $before = $category->only(array_keys($attributes));
            $updated = $this->menus->updateCategory($category, $attributes);
            $result = $this->categoryArray($updated);
            if ($before !== $updated->only(array_keys($attributes))) {
                $this->record($actor, $locked, 'menu.category.updated', 'menu_category', (string) $categoryId, $before, $updated->only(array_keys($attributes)));
            }

            return $result;
        });
    }

    public function createItem(Restaurant $restaurant, User $actor, array $data, UploadedFile $photo): array
    {
        $imagePath = $this->publicPhotos->store($photo);
        try {
            return DB::transaction(function () use ($restaurant, $actor, $data, $imagePath): array {
                $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
                $category = $this->menus->findCategory($locked, (int) $data['category_id']);
                abort_unless($category !== null && $category->status === 'active', 404);
                $tagIds = array_values(array_map('intval', $data['dietary_tag_ids'] ?? []));
                $this->assertHalalTagAllowed($tagIds, $locked);
                $attributes = $this->itemAttributes($data, true);
                $attributes['image_path'] = $imagePath;
                if (($attributes['lifecycle_status'] ?? 'draft') === 'published') {
                    $this->assertCanPublish($category, $tagIds, $locked);
                }
                $item = $this->menus->createItem($category, $attributes, $tagIds);
                $result = $this->itemArray($item);
                $this->record($actor, $locked, 'menu.item.created', 'menu_item', (string) $item->getKey(), null, $this->itemAuditArray($item));

                return $result;
            });
        } catch (\Throwable $exception) {
            $this->publicPhotos->deleteVariants($imagePath);
            throw $exception;
        }
    }

    public function updateItem(Restaurant $restaurant, User $actor, int $itemId, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $itemId, $data): array {
            $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $item = $this->menus->findItem($locked, $itemId);
            abort_unless($item !== null, 404);
            if ($item->lifecycle_status === 'archived') {
                throw ValidationException::withMessages(['lifecycle_status' => ['Archived items cannot be edited.']]);
            }

            $attributes = $this->itemAttributes($data, false);
            $tagIds = array_key_exists('dietary_tag_ids', $data)
                ? array_values(array_map('intval', $data['dietary_tag_ids'] ?? []))
                : null;
            $category = array_key_exists('category_id', $attributes)
                ? $this->menus->findCategory($locked, (int) $attributes['category_id'])
                : $item->category;
            abort_unless($category !== null && $category->status === 'active', 404);
            if ($tagIds !== null) {
                $this->assertHalalTagAllowed($tagIds, $locked);
            } else {
                $tagIds = $item->dietaryTags->modelKeys();
                $this->assertHalalTagAllowed($tagIds, $locked);
            }

            $priceChanged = array_key_exists('price', $attributes)
                && $this->normalizedPrice($attributes['price']) !== $this->normalizedPrice($item->price);
            if ($priceChanged && ! ($data['price_change_acknowledged'] ?? false)) {
                throw ValidationException::withMessages([
                    'price_change_acknowledged' => ['Confirm the price-change warning before saving this update.'],
                ]);
            }
            if (($attributes['lifecycle_status'] ?? $item->lifecycle_status) === 'published') {
                $this->assertCanPublish($category, $tagIds, $locked);
            }

            $attributes = $this->applyQuantityReset($attributes, $item);
            $before = $this->itemAuditArray($item);
            unset($attributes['price_change_acknowledged']);
            $updated = $this->menus->updateItem($item, $attributes, $tagIds);
            $after = $this->itemAuditArray($updated);
            if ($before !== $after) {
                $this->record($actor, $locked, 'menu.item.updated', 'menu_item', (string) $itemId, $before, $after);
            }

            return $this->itemArray($updated);
        });
    }

    public function archiveItem(Restaurant $restaurant, User $actor, int $itemId): void
    {
        DB::transaction(function () use ($restaurant, $actor, $itemId): void {
            $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $item = $this->menus->findItem($locked, $itemId);
            abort_unless($item !== null, 404);
            if ($item->lifecycle_status === 'archived') {
                return;
            }
            $before = $this->itemAuditArray($item);
            $archived = $this->menus->updateItem($item, ['lifecycle_status' => 'archived']);
            $this->record($actor, $locked, 'menu.item.archived', 'menu_item', (string) $itemId, $before, $this->itemAuditArray($archived));
        });
    }

    public function updateAvailability(Restaurant $restaurant, User $actor, int $itemId, bool $isAvailable): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $itemId, $isAvailable): array {
            $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $item = $this->menus->findItem($locked, $itemId);
            abort_unless($item !== null, 404);
            if ($item->lifecycle_status === 'archived') {
                throw ValidationException::withMessages(['is_available' => ['Archived items cannot change availability.']]);
            }
            $before = ['is_available' => (bool) $item->is_available];
            $updated = $this->menus->updateItem($item, ['is_available' => $isAvailable]);
            $after = ['is_available' => (bool) $updated->is_available];
            if ($before !== $after) {
                $this->record($actor, $locked, 'menu.item.availability_changed', 'menu_item', (string) $itemId, $before, $after);
            }

            return $this->itemArray($updated);
        });
    }

    public function bulkPublish(Restaurant $restaurant, User $actor, array $itemIds): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $itemIds): array {
            $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $updated = [];
            $failures = [];
            foreach ($itemIds as $itemId) {
                $item = $this->menus->findItem($locked, (int) $itemId);
                $reason = $item === null ? 'Item is unavailable in this restaurant.' : $this->publishFailure($item, $locked);
                if ($reason !== null) {
                    $failures[] = ['item_id' => (string) $itemId, 'message' => $reason];
                    continue;
                }
                if ($item->lifecycle_status !== 'published') {
                    $before = $this->itemAuditArray($item);
                    $item = $this->menus->updateItem($item, ['lifecycle_status' => 'published']);
                    $this->record($actor, $locked, 'menu.item.published', 'menu_item', (string) $itemId, $before, $this->itemAuditArray($item));
                }
                $updated[] = $this->itemArray($item);
            }

            return ['items' => $updated, 'failures' => $failures];
        });
    }

    public function uploadPhoto(Restaurant $restaurant, User $actor, int $itemId, UploadedFile $file): array
    {
        $item = $this->menus->findItem($restaurant, $itemId);
        abort_unless($item !== null, 404);
        if ($item->lifecycle_status === 'archived') {
            throw ValidationException::withMessages(['file' => ['Archived items cannot have their photo changed.']]);
        }
        $path = $this->publicPhotos->store($file);
        try {
            [$updated, $previousPath] = DB::transaction(function () use ($restaurant, $actor, $itemId, $path): array {
                $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
                $current = $this->menus->findItem($locked, $itemId);
                abort_unless($current !== null && $current->lifecycle_status !== 'archived', 404);
                $previousPath = $current->image_path;
                $item = $this->menus->updateItem($current, ['image_path' => $path]);
                $this->record(
                    $actor,
                    $locked,
                    'menu.item.photo_changed',
                    'menu_item',
                    (string) $itemId,
                    ['image_path' => $previousPath],
                    ['image_path' => $path],
                );

                return [$item, $previousPath];
            });
        } catch (\Throwable $exception) {
            $this->publicPhotos->deleteVariants($path);
            throw $exception;
        }
        if ($previousPath !== null) {
            $this->publicPhotos->deleteVariants($previousPath);
        }

        return $this->itemArray($updated);
    }

    public function uploadHalalCertificate(
        Restaurant $restaurant,
        User $actor,
        UploadedFile $file,
        ?string $expiryDate,
    ): array {
        $application = $this->applications->findLatestApprovedInitialForRestaurant((int) $restaurant->getKey());
        abort_unless($application instanceof RestaurantApplication, 404);
        $path = $this->privateFiles->store($file);
        try {
            DB::transaction(function () use ($restaurant, $actor, $application, $path, $expiryDate): void {
                $locked = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
                $this->documents->create([
                    'application_id' => $application->getKey(),
                    'doc_type' => 'halal_certificate',
                    'private_path' => $path,
                    'expiry_date' => $expiryDate,
                    'verification_state' => 'pending',
                ]);
                $this->record(
                    $actor,
                    $locked,
                    'menu.halal_certificate.uploaded',
                    'restaurant_application',
                    (string) $application->getKey(),
                    ['halal_certificate_available' => $this->menus->hasValidHalalCertificate($locked)],
                    ['halal_certificate_available' => true, 'expiry_date' => $expiryDate],
                );
            });
        } catch (\Throwable $exception) {
            if (! Storage::disk('private')->delete($path)) {
                throw new \RuntimeException('The unused private certificate could not be removed.', 0, $exception);
            }
            throw $exception;
        }

        return ['halal_certificate_available' => $this->menus->hasValidHalalCertificate($restaurant)];
    }

    private function itemAttributes(array $data, bool $creating): array
    {
        $allowed = [
            'category_id',
            'name',
            'description',
            'price',
            'lifecycle_status',
            'is_available',
            'daily_quantity',
            'prep_minutes',
        ];
        $attributes = array_intersect_key($data, array_flip($allowed));
        if ($creating) {
            $attributes['is_available'] ??= true;
            $attributes['lifecycle_status'] ??= 'draft';
            $attributes['daily_quantity'] ??= null;
            $attributes['quantity_left'] = $attributes['daily_quantity'];
        }
        return $attributes;
    }

    private function applyQuantityReset(array $attributes, MenuItem $item): array
    {
        $requestedQuantity = $attributes['daily_quantity'] ?? null;
        $quantityChanged = array_key_exists('daily_quantity', $attributes)
            && ($requestedQuantity === null
                ? $item->daily_quantity !== null
                : (int) $requestedQuantity !== $item->daily_quantity);
        if ($quantityChanged) {
            $attributes['quantity_left'] = $attributes['daily_quantity'];
        } else {
            unset($attributes['daily_quantity']);
        }

        return $attributes;
    }

    private function assertHalalTagAllowed(array $tagIds, Restaurant $restaurant): void
    {
        $hasHalalTag = $this->menus->availableTags()
            ->contains(fn ($tag): bool => $tag->name === 'halal_certified' && in_array((int) $tag->getKey(), $tagIds, true));
        if ($hasHalalTag && ! $this->menus->hasValidHalalCertificate($restaurant)) {
            throw ValidationException::withMessages([
                'dietary_tag_ids' => ['Upload a valid Halal certificate before assigning the Halal-certified tag.'],
            ]);
        }
    }

    private function assertCanPublish(MenuCategory $category, array $tagIds, Restaurant $restaurant): void
    {
        $reason = $category->status !== 'active'
            ? 'Items in archived categories cannot be published.'
            : null;
        if ($reason === null) {
            $this->assertHalalTagAllowed($tagIds, $restaurant);
        } else {
            throw ValidationException::withMessages(['lifecycle_status' => [$reason]]);
        }
    }

    private function publishFailure(MenuItem $item, Restaurant $restaurant): ?string
    {
        if ($item->lifecycle_status === 'archived') {
            return 'Archived items cannot be published.';
        }
        if ($item->category?->status !== 'active') {
            return 'Items in archived categories cannot be published.';
        }
        try {
            $this->assertHalalTagAllowed($item->dietaryTags->modelKeys(), $restaurant);
        } catch (ValidationException $exception) {
            return $exception->errors()['dietary_tag_ids'][0] ?? 'A dietary tag is not valid.';
        }

        return null;
    }

    private function normalizedPrice(mixed $price): string
    {
        return number_format((float) $price, 2, '.', '');
    }

    private function categoryArray(MenuCategory $category): array
    {
        return [
            'id' => (string) $category->getKey(),
            'name' => $category->name,
            'sort_order' => $category->sort_order,
            'status' => $category->status,
        ];
    }

    private function itemArray(MenuItem $item): array
    {
        $item->loadMissing(['category', 'dietaryTags']);

        return [
            'id' => (string) $item->getKey(),
            'category_id' => (string) $item->category_id,
            'category_name' => $item->category?->name,
            'name' => $item->name,
            'description' => $item->description,
            'price' => $item->price,
            'image_url' => $item->image_path ? Storage::disk('public')->url($item->image_path) : null,
            'lifecycle_status' => $item->lifecycle_status,
            'is_available' => (bool) $item->is_available,
            'daily_quantity' => $item->daily_quantity,
            'quantity_left' => $item->quantity_left,
            'prep_minutes' => $item->prep_minutes,
            'is_orderable' => $item->lifecycle_status === 'published'
                && $item->category?->status === 'active'
                && $item->is_available
                && ($item->daily_quantity === null || $item->quantity_left > 0),
            'dietary_tags' => $item->dietaryTags->map(fn ($tag): array => [
                'id' => (string) $tag->getKey(),
                'name' => $tag->name,
                'tag_type' => $tag->tag_type,
            ])->all(),
        ];
    }

    private function itemAuditArray(MenuItem $item): array
    {
        $item->loadMissing(['category', 'dietaryTags']);

        return [
            'id' => (string) $item->getKey(),
            'category_id' => (string) $item->category_id,
            'name' => $item->name,
            'description' => $item->description,
            'price' => $item->price,
            'image_path' => $item->image_path,
            'lifecycle_status' => $item->lifecycle_status,
            'is_available' => (bool) $item->is_available,
            'daily_quantity' => $item->daily_quantity,
            'quantity_left' => $item->quantity_left,
            'prep_minutes' => $item->prep_minutes,
            'dietary_tag_ids' => $item->dietaryTags->modelKeys(),
        ];
    }

    private function record(
        User $actor,
        Restaurant $restaurant,
        string $action,
        string $entityType,
        string $entityId,
        ?array $before,
        ?array $after,
    ): void {
        $this->audit->record([
            'actor_user_id' => $actor->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }
}
