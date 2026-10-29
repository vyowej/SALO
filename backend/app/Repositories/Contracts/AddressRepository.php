<?php

namespace App\Repositories\Contracts;

interface AddressRepository
{
    public function allForUser(string $userId): array;

    public function findForUser(string $userId, string $addressId): ?array;

    public function create(string $userId, array $attributes): array;

    public function update(string $userId, string $addressId, array $attributes): ?array;

    public function delete(string $userId, string $addressId): bool;

    public function setPrimary(string $userId, string $addressId): ?array;
}
