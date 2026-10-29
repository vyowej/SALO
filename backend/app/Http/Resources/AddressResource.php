<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AddressResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $address = (array) $this->resource;

        return [
            'id' => (string) $address['id'],
            'label' => $address['label'] ?? 'Home',
            'detail' => implode(', ', array_filter([
                $address['house_no'] ?? null,
                $address['street'] ?? null,
                $address['barangay'] ?? null,
                $address['city_municipality'] ?? null,
                $address['province'] ?? null,
            ], fn ($part) => is_string($part) && trim($part) !== '')),
            'region' => $address['region'] ?? '',
            'province' => $address['province'] ?? '',
            'city_municipality' => $address['city_municipality'] ?? '',
            'barangay' => $address['barangay'] ?? '',
            'street' => $address['street'] ?? '',
            'house_no' => $address['house_no'] ?? '',
            'latitude' => isset($address['latitude']) ? (float) $address['latitude'] : null,
            'longitude' => isset($address['longitude']) ? (float) $address['longitude'] : null,
            'is_main' => (bool) ($address['is_main'] ?? false),
            'rider_note' => $address['rider_note'] ?? '',
        ];
    }
}
