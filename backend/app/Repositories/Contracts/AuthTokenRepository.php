<?php

namespace App\Repositories\Contracts;

use Illuminate\Support\Carbon;

interface AuthTokenRepository
{
    public function put(string $purpose, string $userId, string $tokenHash, Carbon $expiresAt): void;

    public function find(string $purpose, string $userId): ?array;

    public function forget(string $purpose, string $userId): void;
}
