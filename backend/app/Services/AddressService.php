<?php

namespace App\Services;

use App\Repositories\Contracts\AddressRepository;

class AddressService
{
    public function __construct(private readonly AddressRepository $addresses) {}

    public function list(string $userId): array
    {
        return $this->addresses->allForUser($userId);
    }

    public function create(string $userId, array $attributes): array
    {
        return $this->addresses->create($userId, $attributes);
    }

    public function update(string $userId, string $addressId, array $attributes): ?array
    {
        return $this->addresses->update($userId, $addressId, $attributes);
    }

    public function delete(string $userId, string $addressId): bool
    {
        return $this->addresses->delete($userId, $addressId);
    }

    public function setPrimary(string $userId, string $addressId): ?array
    {
        return $this->addresses->setPrimary($userId, $addressId);
    }
}
