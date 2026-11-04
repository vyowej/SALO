<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminAccountService
{
    public function __construct(
        private readonly PlatformAdminProtection $protection,
    ) {}

    public function list(array $filters): array
    {
        $query = PlatformAdmin::query()
            ->with('user')
            ->whereHas('user');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->whereHas('user', function ($userQuery) use ($search): void {
                $userQuery->where('email', 'like', '%'.$search.'%')
                    ->orWhere('first_name', 'like', '%'.$search.'%')
                    ->orWhere('last_name', 'like', '%'.$search.'%');
            });
        }

        $paginator = $query
            ->orderByDesc('id')
            ->paginate(min(100, max(1, (int) ($filters['per_page'] ?? 15))));

        return [
            'data' => $paginator->getCollection()
                ->map(fn (PlatformAdmin $admin): array => $this->present($admin))
                ->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => max(1, $paginator->lastPage()),
            ],
        ];
    }

    public function find(string $userId): array
    {
        $admin = PlatformAdmin::query()
            ->with('user')
            ->where('user_id', $userId)
            ->firstOrFail();

        return $this->present($admin);
    }

    public function create(array $data, User $actor): array
    {
        $parts = $this->nameParts($data['name']);

        return DB::transaction(function () use ($data, $parts, $actor): array {
            $user = User::query()->create([
                'email' => $data['email'],
                'password_hash' => Hash::make($data['password']),
                'first_name' => $parts[0],
                'last_name' => $parts[1],
                'mobile' => $data['phone'] ?? null,
                'status' => 'active',
            ]);
            $admin = $user->platformAdmin()->create([
                'admin_level' => 'super',
                'status' => 'active',
            ]);
            $this->recordAudit($actor, $user, 'created', null, [
                'email' => $user->email,
                'admin_status' => $admin->status,
            ]);

            return $this->present($admin->load('user'));
        });
    }

    public function update(string $userId, array $data, User $actor): array
    {
        return DB::transaction(function () use ($userId, $data, $actor): array {
            $admin = PlatformAdmin::query()
                ->with('user')
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->firstOrFail();
            $user = $admin->user;
            $before = ['email' => $user->email, 'name' => $user->name, 'phone' => $user->phone];

            if (isset($data['name'])) {
                [$user->first_name, $user->last_name] = $this->nameParts($data['name']);
            }
            if (array_key_exists('email', $data)) {
                $user->email = $data['email'];
            }
            if (array_key_exists('phone', $data)) {
                $user->mobile = $data['phone'];
            }
            $user->save();
            $this->recordAudit($actor, $user, 'updated', $before, [
                'email' => $user->email,
                'name' => $user->name,
                'phone' => $user->phone,
            ]);

            return $this->present($admin->fresh('user'));
        });
    }

    public function setStatus(string $userId, string $status, User $actor): array
    {
        $user = User::query()
            ->whereHas('platformAdmin')
            ->findOrFail($userId);
        if ($status === 'active' && $user->status !== 'active') {
            throw ValidationException::withMessages([
                'status' => ['The User account must be active before Admin access can be reactivated.'],
            ]);
        }

        $changeStatus = function () use ($userId, $status, $actor): array {
            $admin = PlatformAdmin::query()
                ->with('user')
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->firstOrFail();
            $previous = $admin->status;
            $admin->status = $status;
            $admin->save();
            $this->recordAudit($actor, $admin->user, 'status_changed', [
                'admin_status' => $previous,
            ], [
                'admin_status' => $admin->status,
            ]);

            return $this->present($admin->fresh('user'));
        };

        return $status === 'suspended'
            ? $this->protection->whilePreservingLastActiveAdmin($user, $changeStatus)
            : DB::transaction($changeStatus);
    }

    public function assertGenericUserIsNotAdmin(string $userId, ?array $record = null): void
    {
        if (in_array('admin', $record['capabilities'] ?? [], true)) {
            throw ValidationException::withMessages([
                'user' => ['Admin accounts must be managed through Admin account management.'],
            ]);
        }

        if (ctype_digit($userId)
            && User::withTrashed()->whereKey($userId)->whereHas('platformAdmin')->exists()) {
            throw ValidationException::withMessages([
                'user' => ['Admin accounts must be managed through Admin account management.'],
            ]);
        }
    }

    private function present(PlatformAdmin $admin): array
    {
        $user = $admin->user;

        return [
            'id' => (string) $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'status' => $admin->status,
            'account_status' => $user->status,
        ];
    }

    private function nameParts(string $name): array
    {
        $parts = preg_split('/\s+/', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return [array_shift($parts) ?? '', implode(' ', $parts)];
    }

    private function recordAudit(
        User $actor,
        User $subject,
        string $action,
        ?array $before,
        array $after,
    ): void {
        AuditLog::query()->create([
            'actor_user_id' => $actor->getKey(),
            'action' => 'admin_account.'.$action,
            'entity_type' => 'platform_admin',
            'entity_id' => $subject->getKey(),
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }
}
