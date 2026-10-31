<?php

namespace App\Services;

use App\Repositories\Contracts\PsgcLocationRepository;

class PsgcLocationService
{
    public function __construct(private readonly PsgcLocationRepository $locations) {}

    public function list(string $level, ?string $parentCode, ?string $search): array
    {
        return $this->locations->listByLevelParent($level, $parentCode, $search);
    }

    public function search(string $query): array
    {
        return $this->locations->search($query);
    }
}
