<?php

namespace App\Repositories\Contracts;

use App\Models\AuthToken;
use Illuminate\Support\Carbon;

interface AuthTokenRepository
{
    public function issue(int $userId, string $purpose, string $tokenHash, ?string $targetEmail, Carbon $expiresAt): AuthToken;

    public function latest(int $userId, string $purpose, ?string $targetEmail = null): ?AuthToken;

    public function lockActive(int $userId, string $purpose, ?string $targetEmail = null): ?AuthToken;

    public function incrementAttempts(AuthToken $token): void;

    public function consume(AuthToken $token): void;
}
