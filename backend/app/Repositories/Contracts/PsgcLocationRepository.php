<?php

namespace App\Repositories\Contracts;

interface PsgcLocationRepository
{
    public function listByLevelParent(string $level, ?string $parentCode, ?string $search): array;

    public function search(string $query, ?string $level = null, ?string $parentCode = null): array;

    public function resolveAdministrativeCandidates(array $namesByLevel): array;

    public function hierarchyForCode(string $code): ?array;

    public function upsert(array $locations): void;

    public function verificationReport(): array;
}
