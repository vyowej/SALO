<?php

namespace App\Services;

use App\Repositories\Contracts\AddressRepository;

class AddressService
{
    public function __construct(private readonly AddressRepository $addresses) {}

    public function list(string $userId): array
    {
        // DB-INTEGRATION: list only addresses belonging to the authenticated account.
        return $this->addresses->allForUser($userId);
    }

    public function create(string $userId, array $attributes): array
    {
        // DB-INTEGRATION: create an account-owned address and enforce primary-address uniqueness.
        return $this->addresses->create($userId, $attributes);
    }

    public function update(string $userId, string $addressId, array $attributes): ?array
    {
        // DB-INTEGRATION: update by both address and owner identifiers; never accept an owner ID from input.
        return $this->addresses->update($userId, $addressId, $attributes);
    }

    public function delete(string $userId, string $addressId): bool
    {
        // DB-INTEGRATION: delete only an address owned by the authenticated account.
        return $this->addresses->delete($userId, $addressId);
    }

    public function setPrimary(string $userId, string $addressId): ?array
    {
        // DB-INTEGRATION: update the primary address atomically within one account.
        return $this->addresses->setPrimary($userId, $addressId);
    }
}
