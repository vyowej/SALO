<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\EmailVerificationNotification;
use App\Notifications\PasswordResetNotification;
use App\Repositories\Contracts\AuthTokenRepository;
use App\Repositories\Contracts\UserRepository;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthTokenService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly AuthTokenRepository $tokens,
    ) {}

    public function sendPasswordReset(string $email): void
    {
        $user = $this->users->findByEmail(Str::lower(trim($email)));
        if (! $user || $user->status !== 'active') {
            return;
        }

        $token = $this->issue('password-reset', (string) $user->getAuthIdentifier(), 'reset_token_expiry_minutes');
        $user->notify(new PasswordResetNotification($token, (string) config('salo.frontend_url')));
    }

    public function resetPassword(string $email, string $token, string $password): void
    {
        $user = $this->users->findByEmail(Str::lower(trim($email)));
        $record = $user
            ? $this->tokens->find('password-reset', (string) $user->getAuthIdentifier())
            : null;

        if (! $user || $user->status !== 'active' || ! $this->isValid($record, $token)) {
            throw ValidationException::withMessages([
                'token' => ['This password reset link is invalid or has expired.'],
            ]);
        }

        // DB-INTEGRATION: update the password hash and invalidate the user's other sessions atomically.
        $this->users->update($user, ['password' => Hash::make($password)]);
        $this->tokens->forget('password-reset', (string) $user->getAuthIdentifier());
    }

    public function sendEmailVerification(User $user): void
    {
        if ($user->email_verified_at !== null || $user->status !== 'active') {
            return;
        }

        $token = $this->issue('email-verification', (string) $user->getAuthIdentifier(), 'verification_token_expiry_minutes');
        $user->notify(new EmailVerificationNotification($token, (string) config('salo.frontend_url')));
    }

    public function verifyEmail(User $user, string $token): User
    {
        $userId = (string) $user->getAuthIdentifier();
        $record = $this->tokens->find('email-verification', $userId);

        if ($user->email_verified_at !== null) {
            return $user;
        }

        if ($user->status !== 'active' || ! $this->isValid($record, $token)) {
            throw ValidationException::withMessages([
                'token' => ['This verification link is invalid or has expired.'],
            ]);
        }

        // DB-INTEGRATION: persist the verification timestamp and consume the verification token atomically.
        $verified = $this->users->update($user, ['email_verified_at' => Carbon::now()]);
        $this->tokens->forget('email-verification', $userId);

        return $verified;
    }

    private function issue(string $purpose, string $userId, string $expiryConfig): string
    {
        $token = Str::random(64);
        $minutes = max(1, (int) config('salo.auth.'.$expiryConfig));
        $this->tokens->put($purpose, $userId, Hash::make($token), Carbon::now()->addMinutes($minutes));

        return $token;
    }

    private function isValid(?array $record, string $token): bool
    {
        return $record !== null
            && isset($record['token_hash'], $record['expires_at'])
            && Carbon::parse($record['expires_at'])->isFuture()
            && Hash::check($token, $record['token_hash']);
    }
}
