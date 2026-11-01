<?php

namespace App\Services\Contracts;

interface LocationService
{
    public function list(string $level, ?string $parentCode, ?string $search): array;

    public function search(string $query, ?string $level = null, ?string $parentCode = null): array;

    public function searchPlaces(string $query, int $limit): array;

    public function reverseGeocode(float $latitude, float $longitude): array;

    public function hierarchyForCode(string $code): ?array;

    public function verificationReport(): array;
}
