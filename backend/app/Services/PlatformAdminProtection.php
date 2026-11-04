<?php

namespace App\Services;

use App\Models\PlatformAdmin;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PlatformAdminProtection
{
    public function whilePreservingLastActiveAdmin(User $user, Closure $operation): mixed
    {
        return DB::transaction(function () use ($user, $operation): mixed {
            $activeAdmins = PlatformAdmin::query()
                ->where('status', 'active')
                ->whereHas('user', fn ($query) => $query->where('status', 'active'))
                ->orderBy('id')
                ->lockForUpdate()
                ->get(['id', 'user_id']);

            $targetIsActiveAdmin = $activeAdmins->contains(
                fn (PlatformAdmin $admin): bool => (int) $admin->user_id === (int) $user->getKey(),
            );
            if ($targetIsActiveAdmin && $activeAdmins->count() <= 1) {
                throw ValidationException::withMessages([
                    'status' => ['The last active Admin account cannot be deactivated or removed.'],
                ]);
            }

            return $operation();
        });
    }
}
