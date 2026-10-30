<?php

namespace App\Repositories\Database;

use App\Models\PlatformAdmin;
use App\Models\User;
use App\Repositories\Contracts\UserRepository;
use Illuminate\Database\Eloquent\Builder;

class DatabaseUserRepository implements UserRepository
{
    public function create(array $attributes): User
    {
        $user = User::create($this->attributes($attributes));

        if (in_array('admin', $attributes['capabilities'] ?? [], true)) {
            PlatformAdmin::query()->create([
                'user_id' => $user->getKey(),
                'admin_level' => 'super',
                'status' => 'active',
            ]);
        }

        return $user->refresh();
    }

    public function findById(string $id): ?User
    {
        if (! ctype_digit($id)) {
            return null;
        }

        return User::query()->find($id);
    }

    public function findByEmail(string $email): ?User
    {
        return User::query()->where('email', mb_strtolower(trim($email)))->first();
    }

    public function update(User $user, array $attributes): User
    {
        if (array_key_exists('preferences', $attributes)) {
            $user->preferences = $attributes['preferences'];
            unset($attributes['preferences']);
        }

        if (array_key_exists('capabilities', $attributes)) {
            $this->syncCapabilities($user, $attributes['capabilities']);
            unset($attributes['capabilities']);
        }

        $user->fill($this->attributes($attributes))->save();

        return $user->refresh();
    }

    private function attributes(array $attributes): array
    {
        if (isset($attributes['name'])) {
            $parts = preg_split('/\s+/', trim((string) $attributes['name']), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $attributes['first_name'] = array_shift($parts) ?? '';
            $attributes['last_name'] = implode(' ', $parts);
            unset($attributes['name']);
        }

        if (array_key_exists('phone', $attributes)) {
            $attributes['mobile'] = $attributes['phone'];
            unset($attributes['phone']);
        }

        unset($attributes['memberships'], $attributes['driver_state']);

        return $attributes;
    }

    private function syncCapabilities(User $user, array $capabilities): void
    {
        if (in_array('admin', $capabilities, true)) {
            PlatformAdmin::query()->firstOrCreate(
                ['user_id' => $user->getKey()],
                ['admin_level' => 'super', 'status' => 'active'],
            );
        } else {
            $user->platformAdmin()->delete();
        }
    }
}
