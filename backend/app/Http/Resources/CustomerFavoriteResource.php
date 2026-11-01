<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class CustomerFavoriteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $favorite = (array) $this->resource;

        return [
            'type' => $favorite['type'],
            'id' => $favorite['id'],
            'name' => $favorite['name'],
            'restaurant_id' => $favorite['restaurant_id'],
            'image_url' => $this->publicUrl($favorite['image_path'] ?? null),
            'created_at' => $favorite['created_at'],
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
