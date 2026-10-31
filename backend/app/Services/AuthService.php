<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\Contracts\SessionRepository;
use App\Repositories\Contracts\UserRepository;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly AuthTokenService $tokens,
        private readonly SessionRepository $sessions,
    ) {}

    public function register(array $data, Request $request): User
    {
        $email = Str::lower(trim($data['email']));

        if ($this->users->findByEmail($email)) {
            throw ValidationException::withMessages([
                'email' => ['An account with this email already exists.'],
            ]);
        }

        // DB-INTEGRATION: create the account and default customer capability through UserRepository.
        $user = $this->users->create([
            'name' => trim($data['name']),
            'email' => $email,
            'phone' => $data['phone'] ?? null,
            'status' => 'active',
            'email_verified_at' => null,
            'password_hash' => Hash::make($data['password']),
        ]);

        if (! empty($data['address'])) {
            app(AddressService::class)->create((string) $user->getAuthIdentifier(), $data['address']);
        }

        $this->tokens->sendEmailVerification($user);
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('salo.active_mode', 'customer');
        $request->session()->forget('salo.selected_restaurant_id');

        return $user;
    }

    public function login(array $credentials, Request $request): User
    {
        $user = $this->users->findByEmail(Str::lower(trim($credentials['email'])));

        if (! $user || $user->status !== 'active' || ! Hash::check($credentials['password'], $user->getAuthPassword())) {
            throw new AuthenticationException('Authentication is required.');
        }

        $user = $this->users->update($user, ['last_login_at' => now()]);
        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('salo.active_mode', 'customer');
        $request->session()->forget('salo.selected_restaurant_id');

        return $user;
    }

    public function logout(Request $request): void
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }

    public function updateProfile(User $user, array $attributes): User
    {
        // DB-INTEGRATION: persist allowlisted profile attributes and trigger sensitive-field rules when approved.
        $allowed = array_intersect_key($attributes, array_flip(['name', 'phone']));

        return $this->users->update($user, $allowed);
    }

    public function settings(User $user): array
    {
        return $user->preferences ?? [];
    }

    public function updateSettings(User $user, array $preferences): array
    {
        return $this->users->update($user, [
            'preferences' => array_replace($this->settings($user), $preferences),
        ])->preferences;
    }

    public function deactivate(User $user, string $password, ?string $reason, Request $request): void
    {
        if (! Hash::check($password, $user->getAuthPassword())) {
            throw ValidationException::withMessages([
                'password' => ['The password is incorrect.'],
            ]);
        }

        $this->users->update($user, [
            'status' => 'deactivated',
        ]);
        $this->sessions->deleteForUser((int) $user->getAuthIdentifier());
        $this->logout($request);
    }
}
