<?php

namespace App\Repositories\Database;

use App\Models\Invitation;
use App\Models\Restaurant;
use App\Models\RestaurantStaff;
use App\Models\User;
use App\Repositories\Contracts\TeamRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as LengthAwarePaginatorResult;
use Illuminate\Support\Collection;

class DatabaseTeamRepository implements TeamRepository
{
    public function paginateMembers(Restaurant $restaurant, array $filters, ?int $offset = null, ?int $limit = null): LengthAwarePaginator
    {
        $query = $restaurant->staff()->with('user');

        if (! empty($filters['position'])) {
            $query->where('staff_role', $filters['position']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->whereHas('user', function ($user) use ($search, $filters): void {
                $user->where(function ($matches) use ($search, $filters): void {
                    $matches->where('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%');
                    if ($filters['search_email'] ?? true) {
                        $matches->orWhere('email', 'like', '%'.$search.'%');
                    }
                });
            });
        }

        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 15)));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $total = (clone $query)->count();
        $items = $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->offset($offset ?? (($page - 1) * $perPage))
            ->limit($limit ?? $perPage)
            ->get();

        return new LengthAwarePaginatorResult(
            $items,
            $total,
            $perPage,
            $page,
            ['path' => LengthAwarePaginatorResult::resolveCurrentPath()],
        );
    }

    public function pendingInvitations(Restaurant $restaurant): Collection
    {
        return Invitation::query()
            ->with('user')
            ->where('restaurant_id', $restaurant->getKey())
            ->where('status', 'pending')
            ->orderBy('expires_at')
            ->get();
    }

    public function activeMembers(Restaurant $restaurant): Collection
    {
        return $restaurant->staff()
            ->with('user')
            ->where('status', 'active')
            ->orderBy('staff_role')
            ->orderBy('created_at')
            ->get();
    }

    public function findUserByEmail(string $email): ?User
    {
        return User::query()->where('email', mb_strtolower(trim($email)))->first();
    }

    public function createInvitedUser(array $attributes): User
    {
        return User::query()->create($attributes);
    }

    public function staffForUpdate(Restaurant $restaurant, User $user): ?RestaurantStaff
    {
        return RestaurantStaff::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('user_id', $user->getKey())
            ->lockForUpdate()
            ->first();
    }

    public function staffByIdForUpdate(Restaurant $restaurant, int $staffId): ?RestaurantStaff
    {
        return RestaurantStaff::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->whereKey($staffId)
            ->lockForUpdate()
            ->first();
    }

    public function staffByUserIdForUpdate(Restaurant $restaurant, int $userId): ?RestaurantStaff
    {
        return RestaurantStaff::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('user_id', $userId)
            ->lockForUpdate()
            ->first();
    }

    public function staffForInvitation(Restaurant $restaurant, User $user): RestaurantStaff
    {
        $staff = RestaurantStaff::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('user_id', $user->getKey())
            ->lockForUpdate()
            ->first();

        return $staff ?? new RestaurantStaff([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $user->getKey(),
        ]);
    }

    public function pendingInvitationByEmailForUpdate(Restaurant $restaurant, string $email): ?Invitation
    {
        return Invitation::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('pending_key', $restaurant->getKey().':'.mb_strtolower(trim($email)))
            ->lockForUpdate()
            ->first();
    }

    public function invitationForUpdateByHash(string $tokenHash): ?Invitation
    {
        return Invitation::query()
            ->where('token_hash', $tokenHash)
            ->lockForUpdate()
            ->first();
    }

    public function invitationByIdForUpdate(Restaurant $restaurant, int $invitationId): ?Invitation
    {
        return Invitation::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->whereKey($invitationId)
            ->lockForUpdate()
            ->first();
    }

    public function createInvitation(array $attributes): Invitation
    {
        return Invitation::query()->create($attributes);
    }

    public function saveInvitation(Invitation $invitation): Invitation
    {
        $invitation->save();

        return $invitation->refresh();
    }

    public function cancelPendingInvitationsForMember(Restaurant $restaurant, int $userId): int
    {
        return Invitation::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('user_id', $userId)
            ->where('status', 'pending')
            ->update(['status' => 'cancelled', 'updated_at' => now()]);
    }

    public function dueInvitations(?Restaurant $restaurant = null): Collection
    {
        $query = Invitation::query()
            ->with(['user', 'restaurant'])
            ->where('status', 'pending')
            ->where('expires_at', '<=', now());

        if ($restaurant !== null) {
            $query->where('restaurant_id', $restaurant->getKey());
        }

        return $query->lockForUpdate()->get();
    }

    public function restaurantForUpdate(int $restaurantId): ?Restaurant
    {
        return Restaurant::query()->lockForUpdate()->find($restaurantId);
    }

    public function saveRestaurant(Restaurant $restaurant): Restaurant
    {
        $restaurant->save();

        return $restaurant->refresh();
    }
}
