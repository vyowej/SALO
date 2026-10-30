<?php

namespace App\Repositories\Database;

use App\Models\ClosureDate;
use App\Models\CuisineType;
use App\Models\OperatingHour;
use App\Models\Restaurant;
use App\Models\RestaurantPhoto;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class DatabaseRestaurantPageRepository implements RestaurantPageRepository
{
    public function lockRestaurant(int $restaurantId): Restaurant
    {
        return Restaurant::query()->lockForUpdate()->findOrFail($restaurantId);
    }

    public function updateRestaurant(Restaurant $restaurant, array $attributes): Restaurant
    {
        $restaurant->forceFill($attributes)->save();

        return $restaurant->refresh();
    }

    public function syncCuisine(Restaurant $restaurant, ?string $cuisine): void
    {
        $name = trim((string) $cuisine);
        if ($name === '') {
            $restaurant->cuisines()->detach();

            return;
        }

        $type = CuisineType::query()->firstOrCreate(['name' => $name]);
        $restaurant->cuisines()->sync([$type->getKey()]);
        $restaurant->unsetRelation('cuisines');
    }

    public function profile(Restaurant $restaurant): array
    {
        $restaurant->loadMissing(['cuisines', 'photos']);

        return [
            'id' => (string) $restaurant->getKey(),
            'name' => $restaurant->name,
            'category' => $restaurant->category,
            'description' => $restaurant->description,
            'cuisine' => $restaurant->cuisines->pluck('name')->implode(', '),
            'contact_number' => $restaurant->contact_number,
            'business_email' => $restaurant->business_email,
            'legal_name' => $restaurant->legal_name,
            'psgc_code' => $restaurant->psgc_code,
            'street' => $restaurant->street,
            'latitude' => $restaurant->latitude,
            'longitude' => $restaurant->longitude,
            'delivery_radius_km' => $restaurant->delivery_radius_km,
            'prep_minutes' => $restaurant->prep_minutes,
            'is_24_7' => (bool) $restaurant->is_24_7,
            'status' => $restaurant->status,
            'is_published' => (bool) $restaurant->is_published,
            'logo_url' => $restaurant->logo_path ? Storage::disk('public')->url($restaurant->logo_path) : null,
            'cover_url' => $restaurant->cover_path ? Storage::disk('public')->url($restaurant->cover_path) : null,
            'photos' => $restaurant->photos->map(fn (RestaurantPhoto $photo): array => $this->photoArray($photo))->values()->all(),
        ];
    }

    public function photos(Restaurant $restaurant): Collection
    {
        return $restaurant->photos()->get();
    }

    public function galleryPhotoCount(Restaurant $restaurant): int
    {
        return $restaurant->photos()->count();
    }

    public function findPhoto(Restaurant $restaurant, int $photoId): ?RestaurantPhoto
    {
        return $restaurant->photos()->whereKey($photoId)->first();
    }

    public function clearPrimaryPhoto(Restaurant $restaurant): void
    {
        $restaurant->photos()->where('is_primary', true)->update(['is_primary' => false]);
    }

    public function createPhoto(Restaurant $restaurant, array $attributes): RestaurantPhoto
    {
        return $restaurant->photos()->create($attributes);
    }

    public function updatePhoto(RestaurantPhoto $photo, array $attributes): RestaurantPhoto
    {
        $photo->forceFill($attributes)->save();

        return $photo->refresh();
    }

    public function deletePhoto(RestaurantPhoto $photo): void
    {
        $photo->delete();
    }

    public function hours(Restaurant $restaurant): Collection
    {
        return $restaurant->operatingHours()->get();
    }

    public function replaceHours(Restaurant $restaurant, array $hours): Collection
    {
        $restaurant->operatingHours()->delete();
        $restaurant->operatingHours()->createMany($hours);

        return $this->hours($restaurant);
    }

    public function closures(Restaurant $restaurant, ?string $from, ?string $to): Collection
    {
        $query = $restaurant->closureDates();
        if ($from !== null) {
            $query->where('closure_date', '>=', $from);
        }
        if ($to !== null) {
            $query->where('closure_date', '<=', $to);
        }

        return $query->get();
    }

    public function createClosure(Restaurant $restaurant, array $attributes): ClosureDate
    {
        return $restaurant->closureDates()->create($attributes);
    }

    public function findClosure(Restaurant $restaurant, int $closureId): ?ClosureDate
    {
        return $restaurant->closureDates()->whereKey($closureId)->first();
    }

    public function deleteClosure(ClosureDate $closure): void
    {
        $closure->delete();
    }

    private function photoArray(RestaurantPhoto $photo): array
    {
        $base = pathinfo($photo->path, PATHINFO_FILENAME);
        $extension = pathinfo($photo->path, PATHINFO_EXTENSION);
        $directory = dirname($photo->path);
        $makeUrl = fn (string $suffix): string => Storage::disk('public')->url($directory.'/'.$base.$suffix.'.'.$extension);

        return [
            'id' => (string) $photo->getKey(),
            'path' => $photo->path,
            'url' => Storage::disk('public')->url($photo->path),
            'thumbnail_url' => $makeUrl('-thumb'),
            'medium_url' => $makeUrl('-medium'),
            'alt_text' => $photo->alt_text,
            'sort_order' => $photo->sort_order,
            'is_primary' => (bool) $photo->is_primary,
        ];
    }
}
