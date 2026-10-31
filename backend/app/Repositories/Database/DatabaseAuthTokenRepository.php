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
        [$storedPurpose, $storedTargetEmail] = $this->storageKey($purpose, $targetEmail);
        $query = AuthToken::query()
            ->where('user_id', $userId)
            ->where('purpose', $storedPurpose)
            ->whereNull('used_at');

        if ($storedTargetEmail === null) {
            $query->whereNull('target_email');
        } else {
            $query->where('target_email', $storedTargetEmail);
        }

        $token = $query->latest('id')->first();
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
            'purpose' => $storedPurpose,
            'token_hash' => $tokenHash,
            'target_email' => $storedTargetEmail,
            'expires_at' => $expiresAt,
            'attempts' => 0,
            'created_at' => now(),
        ]);
    }

    public function latest(int $userId, string $purpose, ?string $targetEmail = null): ?AuthToken
    {
        return $this->tokenQuery($userId, $purpose, $targetEmail)
            ->latest('id')
            ->first();
    }

    public function lockActive(int $userId, string $purpose, ?string $targetEmail = null): ?AuthToken
    {
        return $this->tokenQuery($userId, $purpose, $targetEmail)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('id')
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
        [$storedPurpose, $storedTargetEmail] = $this->storageKey($purpose, $targetEmail);
        $query = AuthToken::query()
            ->where('user_id', $userId)
            ->where('purpose', $storedPurpose);

        return $storedTargetEmail === null
            ? $query->whereNull('target_email')
            : $query->where('target_email', $storedTargetEmail);
    }

    private function storageKey(string $purpose, ?string $targetEmail): array
    {
        if ($purpose !== 'password_reset') {
            return [
                $purpose,
                $targetEmail === null ? null : mb_strtolower(trim($targetEmail)),
            ];
        }

        if ($targetEmail === null) {
            throw new \InvalidArgumentException('Password reset tokens require a target email.');
        }

        // The live enum has no password_reset value, so isolate reset tokens under email_change.
        return ['email_change', 'password-reset:'.hash('sha256', mb_strtolower(trim($targetEmail)))];
    }
}
