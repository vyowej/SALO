<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AddressResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $address = (array) $this->resource;
        $fullName = $address['psgc_full_name'] ?? null;
        $formattedAddress = $address['formatted_address'] ?? null;
        $locationParts = $fullName
            ? [$fullName]
            : array_filter([
                $address['barangay'] ?? null,
                $address['city_municipality'] ?? null,
                $address['province'] ?? null,
            ]);

        return [
            'id' => (string) $address['id'],
            'label' => $address['label'] ?? 'Home',
            'detail' => $formattedAddress ?: implode(', ', array_filter([
                $address['house_no'] ?? null,
                $address['street'] ?? null,
                ...$locationParts,
            ], fn ($part) => is_string($part) && trim($part) !== '')),
            'country_code' => $address['country_code'] ?? 'PH',
            'psgc_code' => $address['psgc_code'] ?? null,
            'psgc_full_name' => $fullName,
            'formatted_address' => $formattedAddress,
            'address_type' => $address['address_type'] ?? 'home',
            'custom_label' => $address['custom_label'] ?? null,
            'region' => $address['region'] ?? '',
            'province' => $address['province'] ?? '',
            'city_municipality' => $address['city_municipality'] ?? '',
            'barangay' => $address['barangay'] ?? '',
            'street' => $address['street'] ?? '',
            'house_no' => $address['house_no'] ?? '',
            'latitude' => isset($address['latitude']) ? (float) $address['latitude'] : null,
            'longitude' => isset($address['longitude']) ? (float) $address['longitude'] : null,
            'is_default' => (bool) ($address['is_default'] ?? $address['is_main'] ?? false),
            'is_main' => (bool) ($address['is_default'] ?? $address['is_main'] ?? false),
            'delivery_note' => $address['delivery_note'] ?? $address['rider_note'] ?? '',
            'rider_note' => $address['delivery_note'] ?? $address['rider_note'] ?? '',
        ];
    }
}
