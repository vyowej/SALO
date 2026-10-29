<?php

namespace App\Repositories\Stub;

use App\Repositories\Contracts\AuthTokenRepository;
use Illuminate\Support\Carbon;

class InMemoryAuthTokenRepository implements AuthTokenRepository
{
    private array $tokens = [];

    public function put(string $purpose, string $userId, string $tokenHash, Carbon $expiresAt): void
    {
        // DB-INTEGRATION: store a hashed, expiring token with durable single-use semantics.
        $this->tokens[$purpose][$userId] = [
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt->toISOString(),
        ];
        $request = app('request');
        if ($request->hasSession()) {
            $request->session()->put($this->sessionKey($purpose, $userId), $this->tokens[$purpose][$userId]);
        }
    }

    public function find(string $purpose, string $userId): ?array
    {
        // DB-INTEGRATION: load only the active token record for the requested account and purpose.
        $request = app('request');
        if ($request->hasSession()) {
            $record = $request->session()->get($this->sessionKey($purpose, $userId));

            return is_array($record) ? $record : null;
        }

        return $this->tokens[$purpose][$userId] ?? null;
    }

    public function forget(string $purpose, string $userId): void
    {
        // DB-INTEGRATION: consume the token atomically so it cannot be replayed.
        unset($this->tokens[$purpose][$userId]);
        $request = app('request');
        if ($request->hasSession()) {
            $request->session()->forget($this->sessionKey($purpose, $userId));
        }
    }

    private function sessionKey(string $purpose, string $userId): string
    {
        return 'salo.auth_tokens.'.$purpose.'.'.$userId;
    }
}
