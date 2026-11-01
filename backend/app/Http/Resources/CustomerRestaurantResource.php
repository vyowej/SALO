<?php

namespace App\Http\Resources;

use App\Models\OperatingHour;
use App\Models\Restaurant;
use App\Models\RestaurantPhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CustomerRestaurantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var Restaurant $restaurant */
        $restaurant = $this->resource;
        $cuisines = $restaurant->cuisines->pluck('name')->all();
        $photos = $restaurant->photos
            ->map(fn (RestaurantPhoto $photo): array => [
                'id' => (string) $photo->getKey(),
                'url' => $this->publicUrl($photo->path),
                'alt_text' => $photo->alt_text,
                'sort_order' => $photo->sort_order,
                'is_primary' => (bool) $photo->is_primary,
            ])
            ->values()
            ->all();
        $cover = $this->publicUrl($restaurant->cover_path);
        $logo = $this->publicUrl($restaurant->logo_path);
        $average = $restaurant->getAttribute('rating_average');
        $popularity = (int) ($restaurant->getAttribute('popularity_count') ?? 0);

        return [
            'id' => (string) $restaurant->getKey(),
            'name' => $restaurant->name,
            'description' => $restaurant->description,
            'formatted_address' => $restaurant->formatted_address,
            'location' => $restaurant->location?->full_name ?? $restaurant->formatted_address,
            'latitude' => $restaurant->latitude === null ? null : (float) $restaurant->latitude,
            'longitude' => $restaurant->longitude === null ? null : (float) $restaurant->longitude,
            'image' => $cover ?: $logo ?: ($photos[0]['url'] ?? null),
            'cover_url' => $cover,
            'logo_url' => $logo,
            'photos' => $photos,
            'cuisine' => implode(', ', $cuisines),
            'cuisines' => $cuisines,
            'tags' => $restaurant->getAttribute('dietary_badges') ?? [],
            'rating' => $average === null ? null : round((float) $average, 2),
            'rating_count' => (int) ($restaurant->getAttribute('rating_count') ?? 0),
            'popularity_count' => $popularity,
            'is_featured' => $popularity > 0,
            'delivery_radius_km' => $restaurant->delivery_radius_km === null ? null : (float) $restaurant->delivery_radius_km,
            'prep_minutes' => $restaurant->prep_minutes === null ? null : (int) $restaurant->prep_minutes,
            'delivery_fee' => null,
            'delivery_time' => null,
            'service_modes' => ['delivery', 'pickup'],
            'accepts_reservations' => (bool) ($restaurant->reservationSetting?->accepts_reservations ?? false),
            'filipino_only' => $restaurant->cuisines->contains(fn ($cuisine): bool => (bool) $cuisine->is_filipino),
            'is_24_7' => (bool) $restaurant->is_24_7,
            'operating_hours' => $restaurant->operatingHours
                ->groupBy(fn (OperatingHour $hour): int => (int) $hour->weekday % 7)
                ->map(fn ($hours) => $hours->map(fn (OperatingHour $hour): array => [
                    'open' => substr((string) $hour->open_time, 0, 5),
                    'close' => substr((string) $hour->close_time, 0, 5),
                ])->values()->all())
                ->all(),
            'closure_dates' => $restaurant->closureDates
                ->map(fn ($closure): string => $closure->closure_date->toDateString())
                ->all(),
            'distance_km' => $restaurant->getAttribute('distance_km') === null
                ? null
                : (float) $restaurant->getAttribute('distance_km'),
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
