<?php

namespace App\Repositories\Contracts;

use App\Models\ClosureDate;
use App\Models\Restaurant;
use App\Models\RestaurantPhoto;
use Illuminate\Support\Collection;

interface RestaurantPageRepository
{
    public function lockRestaurant(int $restaurantId): Restaurant;

    public function updateRestaurant(Restaurant $restaurant, array $attributes): Restaurant;

    public function syncCuisine(Restaurant $restaurant, ?string $cuisine): void;

    public function profile(Restaurant $restaurant): array;

    public function photos(Restaurant $restaurant): Collection;

    public function galleryPhotoCount(Restaurant $restaurant): int;

    public function findPhoto(Restaurant $restaurant, int $photoId): ?RestaurantPhoto;

    public function clearPrimaryPhoto(Restaurant $restaurant): void;

    public function createPhoto(Restaurant $restaurant, array $attributes): RestaurantPhoto;

    public function updatePhoto(RestaurantPhoto $photo, array $attributes): RestaurantPhoto;

    public function deletePhoto(RestaurantPhoto $photo): void;

    public function hours(Restaurant $restaurant): Collection;

    public function replaceHours(Restaurant $restaurant, array $hours): Collection;

    public function closures(Restaurant $restaurant, ?string $from, ?string $to): Collection;

    public function createClosure(Restaurant $restaurant, array $attributes): ClosureDate;

    public function findClosure(Restaurant $restaurant, int $closureId): ?ClosureDate;

    public function deleteClosure(ClosureDate $closure): void;
}
