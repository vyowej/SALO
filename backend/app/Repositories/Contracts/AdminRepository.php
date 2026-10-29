<?php

namespace App\Repositories\Contracts;

interface AdminRepository
{
    public function all(string $resource): array;

    public function find(string $resource, string $id): ?array;

    public function create(string $resource, array $attributes): array;

    public function update(string $resource, string $id, array $attributes): ?array;

    public function delete(string $resource, string $id): bool;

    public function reset(): void;
}
