<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\EmailVerificationNotification;
use App\Notifications\PasswordResetNotification;
use App\Repositories\Contracts\AuthTokenRepository;
use App\Repositories\Contracts\PlatformSettingsRepository;
use App\Repositories\Contracts\SessionRepository;
use App\Repositories\Contracts\UserRepository;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthTokenService
{
    private const OTP_PURPOSES = [
        'email_verification',
        'business_email',
        'rider_activation',
        'email_change',
    ];

    public function __construct(
        private readonly UserRepository $users,
        private readonly AuthTokenRepository $tokens,
        private readonly PlatformSettingsRepository $settings,
        private readonly SessionRepository $sessions,
    ) {}

    public function sendPasswordReset(string $email): void
    {
        $user = $this->users->findByEmail(Str::lower(trim($email)));
        if (! $user || $user->status !== 'active') {
            return;
        }

        $token = $this->issueOpaqueToken(
            (int) $user->getAuthIdentifier(),
            'password_reset',
            $user->email,
            (int) config('salo.auth.reset_token_expiry_minutes', 60),
        );
        $user->notify(new PasswordResetNotification($token, (string) config('salo.frontend_url')));
    }

    public function resetPassword(string $email, string $token, string $password): void
    {
        $user = $this->users->findByEmail(Str::lower(trim($email)));
        if (! $user || $user->status !== 'active') {
            throw ValidationException::withMessages([
                'token' => ['This password reset link is invalid or has expired.'],
            ]);
        }

        $valid = DB::transaction(function () use ($user, $token, $password): bool {
            $record = $this->tokens->lockActive(
                (int) $user->getAuthIdentifier(),
                'password_reset',
                $user->email,
            );
            if ($record === null || ! Hash::check($token, $record->token_hash)) {
                return false;
            }

            $this->tokens->consume($record);
            $this->users->update($user, ['password' => Hash::make($password)]);
            $this->sessions->deleteForUser((int) $user->getAuthIdentifier());

            return true;
        });

        if (! $valid) {
            throw ValidationException::withMessages([
                'token' => ['This password reset link is invalid or has expired.'],
            ]);
        }
    }

    public function sendEmailVerification(User $user): void
    {
        if ($user->email_verified_at !== null || $user->status !== 'active') {
            return;
        }

        $code = $this->issueOtp($user, 'email_verification', $user->email);
        $user->notify(new EmailVerificationNotification($code));
    }

    public function verifyEmail(User $user, string $code): User
    {
        if ($user->email_verified_at !== null) {
            return $user;
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'code' => ['This verification code is invalid or has expired.'],
            ]);
        }

        $this->consumeOtp($user, 'email_verification', $code, $user->email);

        return $user->refresh();
    }

    public function verifyOtp(User $user, string $purpose, string $code, string $targetEmail): void
    {
        if (! in_array($purpose, self::OTP_PURPOSES, true)) {
            throw new \InvalidArgumentException('Unsupported OTP purpose.');
        }

        $this->consumeOtp($user, $purpose, $code, mb_strtolower(trim($targetEmail)));
    }

    public function issueOtp(User $user, string $purpose, ?string $targetEmail = null): string
    {
        if (! in_array($purpose, self::OTP_PURPOSES, true)) {
            throw new \InvalidArgumentException('Unsupported OTP purpose.');
        }
        if (in_array($purpose, ['business_email', 'email_change'], true) && $targetEmail === null) {
            throw new \InvalidArgumentException('The OTP purpose requires a target email.');
        }

        $userId = (int) $user->getAuthIdentifier();
        $latest = $this->tokens->latest($userId, $purpose, $targetEmail);
        $cooldown = $this->setting('otp_resend_cooldown_seconds', 60);
        if ($latest !== null && $latest->created_at->gt(Carbon::now()->subSeconds($cooldown))) {
            throw ValidationException::withMessages([
                'code' => ['Please wait before requesting another verification code.'],
            ]);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->tokens->issue(
            $userId,
            $purpose,
            Hash::make($code),
            $targetEmail,
            Carbon::now()->addMinutes($this->setting('otp_validity_minutes', 10)),
        );

        return $code;
    }

    private function consumeOtp(User $user, string $purpose, string $code, ?string $targetEmail): void
    {
        $valid = DB::transaction(function () use ($user, $purpose, $code, $targetEmail): bool {
            $record = $this->tokens->lockActive((int) $user->getAuthIdentifier(), $purpose, $targetEmail);
            if ($record === null || $record->attempts >= $this->setting('otp_max_attempts', 5)) {
                return false;
            }

            if (! Hash::check($code, $record->token_hash)) {
                $this->tokens->incrementAttempts($record);

                return false;
            }

            $this->tokens->consume($record);
            if ($purpose === 'email_verification') {
                $this->users->update($user, ['email_verified_at' => Carbon::now()]);
            }

            return true;
        });

        if (! $valid) {
            throw ValidationException::withMessages([
                'code' => ['This verification code is invalid or has expired.'],
            ]);
        }
    }

    private function issueOpaqueToken(int $userId, string $purpose, ?string $targetEmail, int $expiryMinutes): string
    {
        $token = Str::random(64);
        $this->tokens->issue(
            $userId,
            $purpose,
            Hash::make($token),
            $targetEmail,
            Carbon::now()->addMinutes(max(1, $expiryMinutes)),
        );

        return $token;
    }

    private function setting(string $key, int $default): int
    {
        $stored = $this->settings->all();
        $value = $stored[$key] ?? config('salo.auth.'.$key);

        return max(1, is_numeric($value) ? (int) $value : $default);
    }
}
