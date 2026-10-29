<?php

namespace App\Auth;

use App\Models\User;
use App\Repositories\Contracts\UserRepository;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Support\Facades\Hash;

class InMemoryUserProvider implements UserProvider
{
    public function __construct(private readonly UserRepository $users) {}

    public function retrieveById($identifier): ?Authenticatable
    {
        $user = $this->users->findById((string) $identifier);

        return $user?->status === 'active' ? $user : null;
    }

    public function retrieveByToken($identifier, #[\SensitiveParameter] $token): ?Authenticatable
    {
        return null;
    }

    public function updateRememberToken(Authenticatable $user, #[\SensitiveParameter] $token): void {}

    public function retrieveByCredentials(#[\SensitiveParameter] array $credentials): ?Authenticatable
    {
        if (! isset($credentials['email'])) {
            return null;
        }

        $user = $this->users->findByEmail((string) $credentials['email']);

        return $user?->status === 'active' ? $user : null;
    }

    public function validateCredentials(Authenticatable $user, #[\SensitiveParameter] array $credentials): bool
    {
        return $user instanceof User
            && $user->status === 'active'
            && isset($credentials['password'])
            && Hash::check((string) $credentials['password'], $user->getAuthPassword());
    }

    public function rehashPasswordIfRequired(Authenticatable $user, #[\SensitiveParameter] array $credentials, bool $force = false): void
    {
        if (! $user instanceof User || ! isset($credentials['password'])) {
            return;
        }

        if ($force || Hash::needsRehash($user->getAuthPassword())) {
            $this->users->update($user, ['password' => Hash::make((string) $credentials['password'])]);
        }
    }
}
