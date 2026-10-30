<?php

namespace App\Repositories\Database;

use App\Models\AuthToken;
use App\Repositories\Contracts\AuthTokenRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class DatabaseAuthTokenRepository implements AuthTokenRepository
{
    public function issue(int $userId, string $purpose, string $tokenHash, ?string $targetEmail, Carbon $expiresAt): AuthToken
    {
        $query = AuthToken::query()
            ->where('user_id', $userId)
            ->where('purpose', $purpose)
            ->whereNull('used_at');

        if ($targetEmail === null) {
            $query->whereNull('target_email');
        } else {
            $query->where('target_email', mb_strtolower(trim($targetEmail)));
        }

        $token = $query->latest('token_id')->first();
        if ($token !== null) {
            $token->forceFill([
                'token_hash' => $tokenHash,
                'expires_at' => $expiresAt,
                'attempts' => 0,
                'created_at' => now(),
            ])->save();

            return $token;
        }

        return AuthToken::query()->create([
            'user_id' => $userId,
            'purpose' => $purpose,
            'token_hash' => $tokenHash,
            'target_email' => $targetEmail === null ? null : mb_strtolower(trim($targetEmail)),
            'expires_at' => $expiresAt,
            'attempts' => 0,
            'created_at' => now(),
        ]);
    }

    public function latest(int $userId, string $purpose, ?string $targetEmail = null): ?AuthToken
    {
        return $this->tokenQuery($userId, $purpose, $targetEmail)
            ->latest('token_id')
            ->first();
    }

    public function lockActive(int $userId, string $purpose, ?string $targetEmail = null): ?AuthToken
    {
        return $this->tokenQuery($userId, $purpose, $targetEmail)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('token_id')
            ->lockForUpdate()
            ->first();
    }

    public function incrementAttempts(AuthToken $token): void
    {
        $token->increment('attempts');
    }

    public function consume(AuthToken $token): void
    {
        $token->forceFill(['used_at' => now()])->save();
    }

    private function tokenQuery(int $userId, string $purpose, ?string $targetEmail): Builder
    {
        $query = AuthToken::query()
            ->where('user_id', $userId)
            ->where('purpose', $purpose);

        return $targetEmail === null
            ? $query->whereNull('target_email')
            : $query->where('target_email', mb_strtolower(trim($targetEmail)));
    }
}
