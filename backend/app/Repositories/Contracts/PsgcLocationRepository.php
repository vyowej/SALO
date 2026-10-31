<?php

namespace App\Repositories\Contracts;

interface PsgcLocationRepository
{
    public function listByLevelParent(string $level, ?string $parentCode, ?string $search): array;

    public function search(string $query): array;

    public function upsert(array $locations): void;
}
