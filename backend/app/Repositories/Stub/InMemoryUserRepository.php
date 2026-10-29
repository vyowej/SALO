<?php

namespace App\Repositories\Stub;

use App\Models\User;
use App\Repositories\Contracts\UserRepository;
use Illuminate\Support\Str;

class InMemoryUserRepository implements UserRepository
{
    private array $users = [];

    public function create(array $attributes): User
    {
        // DB-INTEGRATION: replace this process/session-scoped account record with the approved user repository.
        $id = (string) Str::uuid();
        $record = array_merge([
            'id' => $id,
            'name' => '',
            'email' => '',
            'phone' => null,
            'status' => 'active',
            'capabilities' => ['customer'],
            'memberships' => [],
            'driver_state' => null,
            'email_verified_at' => null,
            'preferences' => [
                'notifications' => true,
                'promotions' => true,
                'reservationReminders' => true,
                'darkMode' => false,
                'soundAlerts' => false,
            ],
            'password' => '',
            'remember_token' => null,
        ], $attributes, ['id' => $id]);

        $this->users[$id] = $record;

        return $this->rememberCurrentUser($this->hydrate($record));
    }

    public function findById(string $id): ?User
    {
        // DB-INTEGRATION: current-session hydration is temporary until the approved account repository exists.
        $record = $this->users[$id] ?? $this->sessionRecord($id);

        return $record === null ? null : $this->hydrate($record);
    }

    public function findByEmail(string $email): ?User
    {
        // DB-INTEGRATION: replace the in-memory unique-email lookup with a repository-backed lookup.
        $normalizedEmail = mb_strtolower(trim($email));

        foreach ($this->users as $record) {
            if (mb_strtolower($record['email']) === $normalizedEmail) {
                return $this->hydrate($record);
            }
        }

        return null;
    }

    public function update(User $user, array $attributes): User
    {
        // DB-INTEGRATION: persist allowlisted account changes and enforce email uniqueness in the approved store.
        $id = (string) $user->getAuthIdentifier();
        $record = $this->users[$id] ?? $this->sessionRecord($id) ?? $this->recordFromUser($user);
        $updated = array_replace($record, $attributes);
        $updated['id'] = $id;
        $this->users[$id] = $updated;

        return $this->rememberCurrentUser($this->hydrate($updated));
    }

    public function reset(): void
    {
        $this->users = [];
    }

    private function hydrate(array $record): User
    {
        return (new User)->forceFill($record);
    }

    private function recordFromUser(User $user): array
    {
        return [
            'id' => (string) $user->getAuthIdentifier(),
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'status' => $user->status,
            'capabilities' => $user->capabilities ?? [],
            'memberships' => $user->memberships ?? [],
            'driver_state' => $user->driver_state,
            'email_verified_at' => $user->email_verified_at,
            'preferences' => $user->preferences ?? [],
            'password' => $user->getAuthPassword(),
            'remember_token' => null,
        ];
    }

    private function sessionRecord(string $id): ?array
    {
        $request = app('request');
        if (! $request->hasSession()) {
            return null;
        }

        $record = $request->session()->get('salo.auth_user');

        return is_array($record) && ($record['id'] ?? null) === $id
            ? $record
            : null;
    }

    private function rememberCurrentUser(User $user): User
    {
        $request = app('request');
        if ($request->hasSession()) {
            $record = $this->recordFromUser($user);
            unset($record['remember_token']);
            $request->session()->put('salo.auth_user', $record);
        }

        return $user;
    }
}
