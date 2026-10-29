<?php

namespace App\Repositories\Stub;

use App\Repositories\Contracts\AdminRepository;
use Illuminate\Support\Str;

class InMemoryAdminRepository implements AdminRepository
{
    private array $records;

    public function __construct()
    {
        $this->reset();
    }

    public function all(string $resource): array
    {
        return $this->records[$resource] ?? [];
    }

    public function find(string $resource, string $id): ?array
    {
        foreach ($this->all($resource) as $record) {
            if (($record['id'] ?? null) === $id) {
                return $record;
            }
        }

        return null;
    }

    public function create(string $resource, array $attributes): array
    {
        $record = array_merge(['id' => (string) Str::uuid()], $attributes);
        $this->records[$resource][] = $record;

        return $record;
    }

    public function update(string $resource, string $id, array $attributes): ?array
    {
        foreach ($this->records[$resource] ?? [] as $index => $record) {
            if (($record['id'] ?? null) === $id) {
                $this->records[$resource][$index] = array_replace($record, $attributes);

                return $this->records[$resource][$index];
            }
        }

        return null;
    }

    public function delete(string $resource, string $id): bool
    {
        foreach ($this->records[$resource] ?? [] as $index => $record) {
            if (($record['id'] ?? null) === $id) {
                array_splice($this->records[$resource], $index, 1);

                return true;
            }
        }

        return false;
    }

    public function reset(): void
    {
        $this->records = AdminFixtures::records();
    }
}
