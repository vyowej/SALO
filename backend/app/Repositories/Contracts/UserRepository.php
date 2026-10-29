<?php

namespace App\Repositories\Contracts;

use App\Models\User;

interface UserRepository
{
    public function create(array $attributes): User;

    public function findById(string $id): ?User;

    public function findByEmail(string $email): ?User;

    public function update(User $user, array $attributes): User;
}
