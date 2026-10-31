<?php

namespace App\Services;

use App\Repositories\Contracts\AddressRepository;
use App\Repositories\Contracts\PsgcLocationRepository;
use Illuminate\Validation\ValidationException;

class AddressService
{
    public function __construct(
        private readonly AddressRepository $addresses,
        private readonly PsgcLocationRepository $locations,
    ) {}

    public function list(string $userId): array
    {
        return $this->addresses->allForUser($userId);
    }

    public function create(string $userId, array $attributes): array
    {
        return $this->addresses->create($userId, $this->normalize($attributes));
    }

    public function update(string $userId, string $addressId, array $attributes): ?array
    {
        $current = $this->addresses->findForUser($userId, $addressId);
        if ($current === null) {
            return null;
        }

        return $this->addresses->update($userId, $addressId, $this->normalize($attributes, $current));
    }

    public function delete(string $userId, string $addressId): bool
    {
        return $this->addresses->delete($userId, $addressId);
    }

    public function setPrimary(string $userId, string $addressId): ?array
    {
        return $this->addresses->setPrimary($userId, $addressId);
    }

    private function normalize(array $attributes, ?array $current = null): array
    {
        $merged = array_merge($current ?? [], $attributes);
        $barangayCode = $attributes['barangay_code']
            ?? $attributes['psgc_code']
            ?? $current['psgc_code']
            ?? null;
        if (! is_string($barangayCode) || $barangayCode === '') {
            $this->invalid('barangay_code', 'Choose a valid PSGC barangay.');
        }
        if (isset($attributes['barangay_code'], $attributes['psgc_code'])
            && $attributes['barangay_code'] !== $attributes['psgc_code']) {
            $this->invalid('barangay_code', 'The barangay code fields must identify the same location.');
        }

        $hierarchy = $this->locations->hierarchyForCode($barangayCode);
        if ($hierarchy === null || ($hierarchy[0]['level'] ?? null) !== 'barangay') {
            $this->invalid('barangay_code', 'The selected location must be a valid PSGC barangay.');
        }

        $city = $this->ancestor($hierarchy, 'city');
        $province = $this->ancestor($hierarchy, 'province');
        if ($city === null) {
            $this->invalid('barangay_code', 'The barangay must belong to a valid city or municipality.');
        }

        $cityCode = $attributes['city_code'] ?? null;
        if (is_string($cityCode) && $cityCode !== '' && $cityCode !== $city['code']) {
            $this->invalid('city_code', 'The selected barangay does not belong to the chosen city or municipality.');
        }
        if (array_key_exists('barangay_code', $attributes) && (! is_string($cityCode) || $cityCode === '')) {
            $this->invalid('city_code', 'Choose the city or municipality that contains this barangay.');
        }

        $provinceCode = $attributes['province_code'] ?? null;
        if ($province !== null) {
            if (array_key_exists('barangay_code', $attributes) && (! is_string($provinceCode) || $provinceCode === '')) {
                $this->invalid('province_code', 'Choose the province that contains this city or municipality.');
            }
            if (is_string($provinceCode) && $provinceCode !== '' && $provinceCode !== $province['code']) {
                $this->invalid('province_code', 'The selected city or municipality does not belong to the chosen province.');
            }
        } elseif (is_string($provinceCode) && $provinceCode !== '') {
            $this->invalid('province_code', 'This city or municipality has no province; use its region context.');
        }

        $street = $merged['street'] ?? null;
        if (! is_string($street) || trim($street) === '') {
            $this->invalid('street', 'Street is required.');
        }

        [$label, $addressType] = $this->labelMapping($merged);
        $customLabel = $label === 'Other'
            ? trim((string) ($merged['custom_label'] ?? ''))
            : '';
        if ($label === 'Other' && $customLabel === '') {
            $this->invalid('custom_label', 'Enter a custom label for an Other address.');
        }

        $normalized = $attributes;
        unset(
            $normalized['province_code'],
            $normalized['city_code'],
            $normalized['barangay_code'],
            $normalized['country_code'],
            $normalized['formatted_address'],
        );
        $normalized['psgc_code'] = $barangayCode;
        $normalized['country_code'] = 'PH';
        $normalized['street'] = trim($street);
        $normalized['label'] = $label;
        $normalized['address_type'] = $addressType;
        $normalized['custom_label'] = $label === 'Other' ? $customLabel : null;

        return $normalized;
    }

    private function labelMapping(array $attributes): array
    {
        $label = $attributes['label'] ?? null;
        $type = $attributes['address_type'] ?? null;

        if (! is_string($label) || trim($label) === '') {
            $label = match ($type) {
                'home' => 'Home',
                'work' => 'Work',
                'church' => 'Church',
                'other' => 'Other',
                default => 'Home',
            };
        }

        $mapping = match (strtolower(trim($label))) {
            'home' => ['Home', 'home'],
            'work', 'office' => ['Work', 'work'],
            'church' => ['Church', 'church'],
            'school' => ['School', 'other'],
            'other' => ['Other', 'other'],
            default => null,
        };
        if ($mapping === null) {
            $this->invalid('label', 'Choose Home, Work, Church, School, or Other.');
        }

        if (is_string($type) && $type !== $mapping[1]) {
            $this->invalid('address_type', 'The address type does not match the selected label.');
        }

        return $mapping;
    }

    private function ancestor(array $hierarchy, string $level): ?array
    {
        foreach (array_slice($hierarchy, 1) as $location) {
            if (($location['level'] ?? null) === $level) {
                return $location;
            }
        }

        return null;
    }

    private function invalid(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
