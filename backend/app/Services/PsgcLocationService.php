<?php

namespace App\Services;

use App\Exceptions\LocationOutsidePhilippines;
use App\Repositories\Contracts\PsgcLocationRepository;
use App\Services\Contracts\LocationService;
use App\Services\Location\GeoapifyPlaceSearch;
use App\Services\Location\NominatimReverseGeocoder;

class PsgcLocationService implements LocationService
{
    public function __construct(
        private readonly PsgcLocationRepository $locations,
        private readonly GeoapifyPlaceSearch $placeSearch,
        private readonly NominatimReverseGeocoder $reverseGeocoder,
    ) {}

    public function list(string $level, ?string $parentCode, ?string $search): array
    {
        return $this->locations->listByLevelParent($level, $parentCode, $search);
    }

    public function search(string $query, ?string $level = null, ?string $parentCode = null): array
    {
        return $this->locations->search($query, $level, $parentCode);
    }

    public function searchPlaces(string $query, int $limit): array
    {
        return ['suggestions' => $this->placeSearch->search(trim($query), $limit)];
    }

    public function reverseGeocode(float $latitude, float $longitude): array
    {
        $bounds = config('location.philippines_bounds');
        if (
            $latitude < $bounds['min_latitude']
            || $latitude > $bounds['max_latitude']
            || $longitude < $bounds['min_longitude']
            || $longitude > $bounds['max_longitude']
        ) {
            throw new LocationOutsidePhilippines('The requested coordinates are outside the supported bounds.');
        }

        $result = $this->reverseGeocoder->reverse($latitude, $longitude);
        $address = $result['address'];
        if (strtolower((string) ($address['country_code'] ?? '')) !== 'ph') {
            throw new LocationOutsidePhilippines('The reverse-geocoded result is not in the Philippines.');
        }

        $regionCandidates = $this->uniqueNames([$address['state'] ?? null, $address['region'] ?? null]);
        $provinceCandidates = $this->uniqueNames([
            $address['province'] ?? null,
            $address['state_district'] ?? null,
            $address['county'] ?? null,
        ]);
        $explicitProvinceCandidates = $this->uniqueNames([$address['province'] ?? null]);
        $cityCandidates = $this->uniqueNames([
            $address['city'] ?? null,
            $address['town'] ?? null,
            $address['municipality'] ?? null,
        ]);
        // Prefer the most specific Nominatim administrative value that matches a barangay in the resolved city.
        $barangayCandidates = $this->uniqueNames([
            $address['neighbourhood'] ?? null,
            $address['neighborhood'] ?? null,
            $address['quarter'] ?? null,
            $address['suburb'] ?? null,
            $address['village'] ?? null,
            $address['hamlet'] ?? null,
        ]);

        $regionLocation = $this->matchChild($regionCandidates, 'region', null, true);
        $provinceLocation = $regionLocation === null
            ? null
            : $this->matchChild($provinceCandidates, 'province', $regionLocation['code']);

        $cityParentCode = null;
        if ($provinceLocation !== null) {
            $cityParentCode = $provinceLocation['code'];
        } elseif ($regionLocation !== null && $explicitProvinceCandidates === []) {
            $cityParentCode = $regionLocation['code'];
        }
        $cityLocation = $cityParentCode === null
            ? null
            : $this->matchChild($cityCandidates, 'city', $cityParentCode);
        if ($regionLocation !== null && $provinceLocation === null && $cityLocation === null) {
            $cityLocation = $this->matchCityWithinRegion($cityCandidates, $regionLocation);
            if ($cityLocation !== null && isset($cityLocation['province'])) {
                $provinceLocation = $cityLocation['province'];
            }
        }
        $barangayLocation = $cityLocation === null
            ? null
            : $this->matchChild($barangayCandidates, 'barangay', $cityLocation['code']);

        $region = $regionLocation['name'] ?? '';
        $province = $provinceLocation['name'] ?? '';
        $city = $cityLocation['name'] ?? '';
        $barangay = $barangayLocation['name'] ?? '';
        $provinceDisplay = null;
        if ($regionLocation !== null && $regionLocation['code'] === config('location.ncr_region_code')) {
            $provinceDisplay = 'Metro Manila (NCR)';
        } elseif ($cityLocation !== null && $provinceLocation === null) {
            $provinceDisplay = 'None (independent city)';
        }

        $street = $this->firstValue($address, ['road', 'pedestrian', 'residential', 'footway']);
        $houseNumber = trim((string) ($address['house_number'] ?? ''));
        $formattedAddress = implode(', ', array_filter([
            $houseNumber,
            $street,
            $barangay,
            $city,
            $provinceDisplay ?? $province,
            $regionLocation !== null && $regionLocation['code'] === config('location.ncr_region_code') ? '' : $region,
            'Philippines',
        ], fn (string $part): bool => $part !== ''));

        return [
            'country_code' => 'PH',
            'region_code' => $regionLocation['code'] ?? null,
            'province_code' => $provinceLocation['code'] ?? null,
            'city_code' => $cityLocation['code'] ?? null,
            'barangay_code' => $barangayLocation['code'] ?? null,
            'region' => $region,
            'province' => $province,
            'province_display' => $province !== '' ? $province : $provinceDisplay,
            'city' => $city,
            'barangay' => $barangay,
            'street' => $street,
            'house_no' => $houseNumber,
            'formatted_address' => $formattedAddress,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'unresolved_components' => array_keys(array_filter([
                'region' => $regionLocation === null,
                'province' => $explicitProvinceCandidates !== [] && $provinceLocation === null,
                'city' => $cityCandidates !== [] && $cityLocation === null,
                'barangay' => $barangayCandidates !== [] && $barangayLocation === null,
            ])),
        ];
    }

    public function hierarchyForCode(string $code): ?array
    {
        return $this->locations->hierarchyForCode($code);
    }

    public function verificationReport(): array
    {
        return $this->locations->verificationReport();
    }

    private function matchChild(array $candidates, string $level, ?string $parentCode, bool $isRegion = false): ?array
    {
        if ($candidates === [] || ($level !== 'region' && $parentCode === null)) {
            return null;
        }

        $locations = $this->locations->listByLevelParent($level, $parentCode, null);
        foreach ($candidates as $candidate) {
            $matchingLocations = [];
            foreach ($locations as $location) {
                if ($this->namesMatch(
                    $location['name'],
                    $candidate,
                    $isRegion,
                )) {
                    $matchingLocations[] = $location;
                }
            }
            if (count($matchingLocations) === 1) {
                return $matchingLocations[0];
            }
            if (count($matchingLocations) > 1) {
                return null;
            }
        }

        return null;
    }

    private function matchCityWithinRegion(array $candidates, array $region): ?array
    {
        $provinces = $this->locations->listByLevelParent('province', $region['code'], null);
        $citiesByParent = [$region['code'] => null];
        foreach ($provinces as $province) {
            $citiesByParent[$province['code']] = $province;
        }

        foreach ($candidates as $candidate) {
            $matches = [];
            foreach ($citiesByParent as $parentCode => $province) {
                foreach ($this->locations->listByLevelParent('city', $parentCode, null) as $city) {
                    if ($this->namesMatch($city['name'], $candidate)) {
                        $matches[] = ['city' => $city, 'province' => $province];
                    }
                }
            }

            if (count($matches) === 1) {
                return [
                    ...$matches[0]['city'],
                    'province' => $matches[0]['province'],
                ];
            }
            if (count($matches) > 1) {
                return null;
            }
        }

        return null;
    }

    private function namesMatch(string $storedName, string $providerName, bool $isRegion = false): bool
    {
        $normalizedStored = $this->normalizeLocationName($storedName);
        $normalizedProvider = $this->normalizeLocationName($providerName);
        if ($isRegion) {
            $normalizedProvider = [
                'metro manila' => 'ncr',
                'national capital region' => 'ncr',
            ][$normalizedProvider] ?? $normalizedProvider;
        }

        return $normalizedStored !== '' && $normalizedStored === $normalizedProvider;
    }

    private function normalizeLocationName(string $name): string
    {
        $normalized = mb_strtolower(trim($name), 'UTF-8');
        if (class_exists(\Normalizer::class)) {
            $normalized = \Normalizer::normalize($normalized, \Normalizer::FORM_D) ?: $normalized;
            $normalized = preg_replace('/\p{Mn}+/u', '', $normalized) ?? $normalized;
        } elseif (function_exists('iconv')) {
            $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized);
            if ($ascii !== false) {
                $normalized = $ascii;
            }
        }

        $normalized = preg_replace('/[^\pL\pN]+/u', ' ', $normalized) ?? $normalized;
        $normalized = trim(preg_replace('/\s+/u', ' ', $normalized) ?? $normalized);
        if (str_starts_with($normalized, 'city of ')) {
            $normalized = substr($normalized, strlen('city of '));
        }
        if (str_ends_with($normalized, ' city')) {
            $normalized = substr($normalized, 0, -strlen(' city'));
        }

        return trim(preg_replace('/\s+/u', ' ', $normalized) ?? $normalized);
    }

    private function uniqueNames(array $values): array
    {
        return array_values(array_unique(array_filter(
            array_map(fn ($value): string => is_string($value) ? trim($value) : '', $values),
            fn (string $value): bool => $value !== '',
        )));
    }

    private function firstValue(array $values, array $keys): string
    {
        foreach ($keys as $key) {
            if (is_string($values[$key] ?? null) && trim($values[$key]) !== '') {
                return trim($values[$key]);
            }
        }

        return '';
    }
}
