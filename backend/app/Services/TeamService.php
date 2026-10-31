<?php

namespace App\Services;

use App\Http\Authorization\PermissionMap;
use App\Models\BusinessNotification;
use App\Models\Invitation;
use App\Models\Restaurant;
use App\Models\RestaurantStaff;
use App\Models\User;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\TeamRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TeamService
{
    private const POSITIONS = [
        'owner' => [
            'name' => 'Owner',
            'description' => 'Sets restaurant direction, manages the team, and owns the restaurant.',
        ],
        'manager' => [
            'name' => 'Manager',
            'description' => 'Runs daily operations and manages restaurant content.',
        ],
        'reservation_manager' => [
            'name' => 'Reservation Manager',
            'description' => 'Manages reservations and tables.',
        ],
        'staff' => [
            'name' => 'Staff',
            'description' => 'Prepares orders and updates item availability.',
        ],
    ];

    public function __construct(
        private readonly TeamRepository $team,
        private readonly AuditLogRepository $audit,
    ) {}

    public function list(Restaurant $restaurant, User $viewer, array $filters): array
    {
        if ($restaurant->status !== 'suspended') {
            $this->expireDueInvitations($restaurant);
        }
        $viewerRole = $viewer->restaurantMembership($restaurant)['role'] ?? 'staff';
        $filters['search_email'] = $viewerRole !== 'manager';
        $ownerMatchesFilters = $this->matchesOwnerFilters($restaurant, $filters, $filters['search_email']);
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 15)));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $offset = ($page - 1) * $perPage;
        $limit = $perPage;
        if ($ownerMatchesFilters) {
            $offset = max(0, $offset - 1);
            if ($page === 1) {
                $limit = max(0, $perPage - 1);
            }
        }

        /** @var LengthAwarePaginator $members */
        $members = $this->team->paginateMembers($restaurant, $filters, $offset, $limit);
        $memberRows = $members->getCollection()
            ->map(fn (RestaurantStaff $staff): array => $this->memberData($staff, $viewer))
            ->all();

        if ($ownerMatchesFilters && $members->currentPage() === 1) {
            array_unshift($memberRows, $this->ownerData($restaurant, $viewer));
        }

        $invitations = $this->team->pendingInvitations($restaurant)
            ->map(fn (Invitation $invitation): array => $this->invitationData($invitation, $viewer))
            ->values()
            ->all();
        $activeMembers = $this->team->activeMembers($restaurant);
        $positionHolders = ['owner' => array_filter([$restaurant->owner?->name])];
        foreach ($activeMembers as $staff) {
            $positionHolders[$staff->staff_role][] = $staff->user?->name;
        }
        $activeManagers = $activeMembers
            ->where('staff_role', 'manager')
            ->map(fn (RestaurantStaff $staff): array => [
                'user_id' => (string) $staff->user_id,
                'name' => $staff->user?->name,
            ])
            ->values()
            ->all();

        return [
            'positions' => $this->positions(),
            'position_holders' => $positionHolders,
            'active_managers' => $activeManagers,
            'members' => [
                'data' => $memberRows,
                'meta' => [
                    'current_page' => $members->currentPage(),
                    'per_page' => $members->perPage(),
                    'total' => $members->total() + ($ownerMatchesFilters ? 1 : 0),
                    'last_page' => max(1, (int) ceil(($members->total() + ($ownerMatchesFilters ? 1 : 0)) / $members->perPage())),
                ],
            ],
            'invitations' => $invitations,
            'can_manage' => PermissionMap::allows(
                (string) ($viewer->restaurantMembership($restaurant)['role'] ?? ''),
                'team.manage',
            ),
        ];
    }

    public function checkEmail(Restaurant $restaurant, User $actor, string $email): array
    {
        $this->expireDueInvitations($restaurant);
        $email = mb_strtolower(trim($email));
        $user = $this->team->findUserByEmail($email);
        $this->record($actor, $restaurant, 'team.email_checked', 'user_lookup', null, null, [
            'email_hash' => hash('sha256', $email),
            'account_exists' => $user !== null,
        ]);

        if ($user === null) {
            return ['exists' => false, 'can_invite' => true, 'identity' => null];
        }

        $staff = $this->team->staffForUpdate($restaurant, $user);
        $isOwner = (int) $restaurant->owner_user_id === (int) $user->getKey();
        $isPending = $this->team->pendingInvitationByEmailForUpdate($restaurant, $email) !== null;
        $alreadyMember = $staff !== null && in_array($staff->status, ['active', 'suspended', 'invited'], true);

        return [
            'exists' => true,
            'can_invite' => in_array($user->status, ['active', 'invited'], true) && ! $isOwner && ! $isPending && ! $alreadyMember,
            'identity' => [
                'first_name' => $user->first_name,
                'last_initial' => $user->last_name === '' ? '' : mb_substr($user->last_name, 0, 1).'.',
                'email_masked' => $this->maskEmail($user->email),
                'avatar_url' => $user->avatar_url,
            ],
            'message' => ! in_array($user->status, ['active', 'invited'], true)
                ? 'This account cannot accept an invitation right now.'
                : ($isOwner
                    ? 'This person already owns this restaurant.'
                    : ($alreadyMember
                        ? 'This person already has a team membership.'
                        : ($isPending ? 'A pending invitation already exists.' : ($user->status === 'invited' ? 'This account must be activated before it can accept an invitation.' : null)))),
            'membership_status' => $staff?->status,
        ];
    }

    public function invite(Restaurant $restaurant, User $actor, array $data): array
    {
        $this->expireDueInvitations($restaurant);
        $email = mb_strtolower(trim($data['email']));
        $role = $data['position'];
        $token = Str::random(64);

        $invitation = DB::transaction(function () use ($restaurant, $actor, $email, $role, $data, $token): Invitation {
            $lockedRestaurant = $this->team->restaurantForUpdate((int) $restaurant->getKey());
            abort_if($lockedRestaurant === null, 404);
            abort_if((int) $lockedRestaurant->owner_user_id === (int) $this->team->findUserByEmail($email)?->getKey(), 422);

            if ($this->team->pendingInvitationByEmailForUpdate($lockedRestaurant, $email) !== null) {
                throw ValidationException::withMessages([
                    'email' => ['A pending invitation already exists for this email.'],
                ]);
            }

            $user = $this->team->findUserByEmail($email);
            if ($user === null) {
                [$firstName, $lastName] = $this->pendingName($data['invitee_name'] ?? null);
                $user = $this->team->createInvitedUser([
                    'email' => $email,
                    'password_hash' => Hash::make(Str::random(64)),
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'status' => 'invited',
                ]);
            } elseif ($user->status !== 'active' && $user->status !== 'invited') {
                throw ValidationException::withMessages([
                    'email' => ['This account cannot accept an invitation right now.'],
                ]);
            }

            $staff = $this->team->staffForInvitation($lockedRestaurant, $user);
            if ($staff->exists && in_array($staff->status, ['active', 'suspended', 'invited'], true)) {
                throw ValidationException::withMessages([
                    'email' => ['This person already has a team membership.'],
                ]);
            }
            $staff->staff_role = $role;
            $staff->status = 'invited';
            $staff->save();

            $invitation = $this->team->createInvitation([
                'restaurant_id' => $lockedRestaurant->getKey(),
                'user_id' => $user->getKey(),
                'invited_by' => $actor->getKey(),
                'invited_email' => $email,
                'staff_role' => $role,
                'token_hash' => hash('sha256', $token),
                'status' => 'pending',
                'expires_at' => now()->addHours(72),
            ]);

            $this->record($actor, $lockedRestaurant, 'team.invitation_sent', 'invitation', (string) $invitation->getKey(), null, [
                'email_hash' => hash('sha256', $email),
                'position' => $role,
                'existing_account' => $user->status === 'active',
            ]);

            return $invitation->load('user', 'restaurant');
        });

        $this->deliverInvitation($invitation, $token);

        return $this->invitationData($invitation, $actor, $token);
    }

    public function resend(Restaurant $restaurant, User $actor, int $invitationId): array
    {
        $this->expireDueInvitations($restaurant);
        $token = Str::random(64);
        $invitation = DB::transaction(function () use ($restaurant, $actor, $invitationId, $token): Invitation {
            $invitation = $this->team->invitationByIdForUpdate($restaurant, $invitationId);
            abort_unless($invitation !== null && $invitation->status === 'pending', 404);
            $invitation->token_hash = hash('sha256', $token);
            $invitation->expires_at = now()->addHours(72);
            $invitation = $this->team->saveInvitation($invitation)->load('user', 'restaurant');
            $this->record($actor, $restaurant, 'team.invitation_resent', 'invitation', (string) $invitation->getKey(), null, [
                'email_hash' => hash('sha256', $invitation->invited_email),
                'position' => $invitation->staff_role,
            ]);

            return $invitation;
        });

        $this->deliverInvitation($invitation, $token);

        return $this->invitationData($invitation, $actor, $token);
    }

    public function cancel(Restaurant $restaurant, User $actor, int $invitationId): void
    {
        DB::transaction(function () use ($restaurant, $actor, $invitationId): void {
            $invitation = $this->team->invitationByIdForUpdate($restaurant, $invitationId);
            abort_unless($invitation !== null && $invitation->status === 'pending', 404);
            $invitation->status = 'cancelled';
            $this->team->saveInvitation($invitation);
            $staff = $this->team->staffByUserIdForUpdate($restaurant, (int) $invitation->user_id);
            if ($staff !== null && $staff->status === 'invited') {
                $staff->status = 'removed';
                $staff->save();
            }
            $this->record($actor, $restaurant, 'team.invitation_cancelled', 'invitation', (string) $invitation->getKey(), [
                'status' => 'pending',
            ], ['status' => 'cancelled']);
        });
    }

    public function updateMember(Restaurant $restaurant, User $actor, int $membershipId, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $membershipId, $data): array {
            $staff = $this->team->staffByIdForUpdate($restaurant, $membershipId);
            abort_unless($staff !== null, 404);
            abort_if($staff->status === 'removed', 422);
            $before = ['position' => $staff->staff_role, 'status' => $staff->status];
            if (isset($data['position'])) {
                $staff->staff_role = $data['position'];
            }
            if (isset($data['status'])) {
                if ($staff->status === 'invited') {
                    throw ValidationException::withMessages(['status' => ['An invitee must accept their invitation before being activated.']]);
                }
                $staff->status = $data['status'];
            }
            if ($before === ['position' => $staff->staff_role, 'status' => $staff->status]) {
                throw ValidationException::withMessages(['position' => ['Choose a position or status change.']]);
            }
            $staff->save();
            $after = ['position' => $staff->staff_role, 'status' => $staff->status];
            $this->record($actor, $restaurant, 'team.member_updated', 'restaurant_staff', (string) $staff->getKey(), $before, $after);

            return $this->memberData($staff->load('user'), $actor);
        });
    }

    public function removeMember(Restaurant $restaurant, User $actor, int $membershipId): void
    {
        DB::transaction(function () use ($restaurant, $actor, $membershipId): void {
            $staff = $this->team->staffByIdForUpdate($restaurant, $membershipId);
            abort_unless($staff !== null, 404);
            abort_if($staff->status === 'removed', 422);
            $before = ['position' => $staff->staff_role, 'status' => $staff->status];
            $staff->status = 'removed';
            $staff->save();
            $this->team->cancelPendingInvitationsForMember($restaurant, (int) $staff->user_id);
            $this->record($actor, $restaurant, 'team.member_removed', 'restaurant_staff', (string) $staff->getKey(), $before, [
                'position' => $staff->staff_role,
                'status' => 'removed',
            ]);
        });
    }

    public function accept(string $token, User $user): array
    {
        $result = DB::transaction(function () use ($token, $user): array {
            $invitation = $this->team->invitationForUpdateByHash(hash('sha256', $token));
            abort_unless($invitation !== null && $invitation->status === 'pending', 404);
            abort_unless(hash_equals($invitation->invited_email, mb_strtolower(trim($user->email))), 403);
            if ($invitation->expires_at->isPast()) {
                $this->expireInvitation($invitation);
                return ['expired' => true];
            }
            abort_unless($user->status === 'active', 403);
            $restaurant = $invitation->restaurant;
            abort_unless($restaurant !== null && $restaurant->status !== 'suspended', 403);
            $staff = $this->team->staffByUserIdForUpdate($restaurant, (int) $user->getKey());
            abort_unless($staff !== null && $staff->status === 'invited', 404);
            $staff->status = 'active';
            $staff->save();
            $invitation->status = 'accepted';
            $invitation->accepted_at = now();
            $this->team->saveInvitation($invitation);
            $this->record($user, $restaurant, 'team.invitation_accepted', 'invitation', (string) $invitation->getKey(), [
                'status' => 'pending',
            ], [
                'status' => 'accepted',
                'position' => $staff->staff_role,
            ]);

            return [
                'restaurant_id' => (string) $restaurant->getKey(),
                'restaurant_name' => $restaurant->name,
                'position' => $staff->staff_role,
                'permissions' => PermissionMap::forRole($staff->staff_role),
            ];
        });

        if ($result['expired'] ?? false) {
            throw ValidationException::withMessages(['token' => ['This invitation has expired.']]);
        }

        return $result;
    }

    public function activate(string $token, array $data): array
    {
        $result = DB::transaction(function () use ($token, $data): array {
            $invitation = $this->team->invitationForUpdateByHash(hash('sha256', $token));
            abort_unless($invitation !== null && $invitation->status === 'pending', 404);
            if ($invitation->expires_at->isPast()) {
                $this->expireInvitation($invitation);
                return ['expired' => true];
            }
            $user = $invitation->user;
            $restaurant = $invitation->restaurant;
            abort_unless($user !== null && $user->status === 'invited', 403);
            abort_unless($restaurant !== null && $restaurant->status !== 'suspended', 403);
            $staff = $this->team->staffByUserIdForUpdate($restaurant, (int) $user->getKey());
            abort_unless($staff !== null && $staff->status === 'invited', 404);
            $user->first_name = trim($data['first_name']);
            $user->last_name = trim($data['last_name']);
            $user->password_hash = Hash::make($data['password']);
            $user->status = 'active';
            $user->email_verified_at = now();
            $user->save();
            $staff->status = 'active';
            $staff->save();
            $invitation->status = 'accepted';
            $invitation->accepted_at = now();
            $this->team->saveInvitation($invitation);
            $this->record($user, $restaurant, 'team.invitation_accepted', 'invitation', (string) $invitation->getKey(), [
                'status' => 'pending',
            ], [
                'status' => 'accepted',
                'position' => $staff->staff_role,
            ]);

            return [
                'restaurant_name' => $restaurant->name,
                'position' => $staff->staff_role,
            ];
        });

        if ($result['expired'] ?? false) {
            throw ValidationException::withMessages(['token' => ['This invitation has expired.']]);
        }

        return $result;
    }

    public function transferOwnership(Restaurant $restaurant, User $actor, int $managerUserId, ?string $password): array
    {
        if ($password !== null && ! Hash::check($password, $actor->getAuthPassword())) {
            throw ValidationException::withMessages(['password' => ['The password is incorrect.']]);
        }

        return DB::transaction(function () use ($restaurant, $actor, $managerUserId): array {
            $lockedRestaurant = $this->team->restaurantForUpdate((int) $restaurant->getKey());
            abort_unless($lockedRestaurant !== null && (int) $lockedRestaurant->owner_user_id === (int) $actor->getKey(), 403);
            $target = $this->team->staffByUserIdForUpdate($lockedRestaurant, $managerUserId);
            abort_unless($target !== null && $target->staff_role === 'manager' && $target->status === 'active', 422);
            $newOwner = $target->user;
            abort_unless($newOwner !== null && $newOwner->status === 'active', 422);

            $before = ['owner_user_id' => (string) $lockedRestaurant->owner_user_id];
            $target->status = 'removed';
            $target->save();
            $formerOwnerStaff = $this->team->staffForInvitation($lockedRestaurant, $actor);
            $formerOwnerStaff->staff_role = 'manager';
            $formerOwnerStaff->status = 'active';
            $formerOwnerStaff->save();
            $lockedRestaurant->owner_user_id = $newOwner->getKey();
            $this->team->saveRestaurant($lockedRestaurant);
            $this->record($actor, $lockedRestaurant, 'ownership.transferred', 'restaurant', (string) $lockedRestaurant->getKey(), $before, [
                'owner_user_id' => (string) $newOwner->getKey(),
                'former_owner_position' => 'manager',
            ]);

            return [
                'restaurant_id' => (string) $lockedRestaurant->getKey(),
                'owner_user_id' => (string) $newOwner->getKey(),
                'former_owner_position' => 'manager',
            ];
        });
    }

    public function adminTransferOwnership(Restaurant $restaurant, User $actor, int $managerUserId, string $reason): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $managerUserId, $reason): array {
            $lockedRestaurant = $this->team->restaurantForUpdate((int) $restaurant->getKey());
            abort_unless($lockedRestaurant !== null, 404);
            $formerOwner = $lockedRestaurant->owner;
            $target = $this->team->staffByUserIdForUpdate($lockedRestaurant, $managerUserId);
            abort_unless($target !== null && $target->staff_role === 'manager' && $target->status === 'active', 422);
            $newOwner = $target->user;
            abort_unless($newOwner !== null && $newOwner->status === 'active', 422);

            $before = ['owner_user_id' => (string) $lockedRestaurant->owner_user_id];
            $target->status = 'removed';
            $target->save();
            $formerOwnerStaff = $this->team->staffForInvitation($lockedRestaurant, $formerOwner);
            $formerOwnerStaff->staff_role = 'manager';
            $formerOwnerStaff->status = 'active';
            $formerOwnerStaff->save();
            $lockedRestaurant->owner_user_id = $newOwner->getKey();
            $this->team->saveRestaurant($lockedRestaurant);
            $this->record($actor, $lockedRestaurant, 'ownership.transferred_by_admin', 'restaurant', (string) $lockedRestaurant->getKey(), $before, [
                'owner_user_id' => (string) $newOwner->getKey(),
                'former_owner_position' => 'manager',
                'reason' => $reason,
            ]);

            return [
                'restaurant_id' => (string) $lockedRestaurant->getKey(),
                'owner_user_id' => (string) $newOwner->getKey(),
                'former_owner_position' => 'manager',
            ];
        });
    }

    public function expireDueInvitations(?Restaurant $restaurant = null): int
    {
        return DB::transaction(function () use ($restaurant): int {
            $invitations = $this->team->dueInvitations($restaurant);
            foreach ($invitations as $invitation) {
                $this->expireInvitation($invitation);
            }

            return $invitations->count();
        });
    }

    private function expireInvitation(Invitation $invitation): void
    {
        $invitation->status = 'expired';
        $this->team->saveInvitation($invitation);
        if ($invitation->restaurant !== null) {
            $staff = $this->team->staffByUserIdForUpdate($invitation->restaurant, (int) $invitation->user_id);
            if ($staff !== null && $staff->status === 'invited') {
                $staff->status = 'removed';
                $staff->save();
            }
        }
    }

    private function positions(): array
    {
        $positions = [];
        foreach (self::POSITIONS as $role => $position) {
            $positions[] = [
                'key' => $role,
                'name' => $position['name'],
                'description' => $position['description'],
                'permissions' => PermissionMap::forRole($role),
                'assignable' => $role !== 'owner',
            ];
        }

        return $positions;
    }

    private function memberData(RestaurantStaff $staff, User $viewer): array
    {
        $user = $staff->user;
        $viewerRole = $viewer->restaurantMembership($staff->restaurant)['role'] ?? 'staff';

        return [
            'id' => (string) $staff->getKey(),
            'user_id' => (string) $staff->user_id,
            'name' => $user?->name,
            'email' => $viewerRole === 'manager' ? $this->maskEmail((string) $user?->email) : $user?->email,
            'position' => $staff->staff_role,
            'position_name' => self::POSITIONS[$staff->staff_role]['name'] ?? $staff->staff_role,
            'status' => $staff->status,
            'joined_at' => $staff->created_at?->toISOString(),
            'last_active_at' => $user?->last_login_at?->toISOString(),
            'permissions' => $staff->status === 'active' ? PermissionMap::forRole($staff->staff_role) : [],
            'can_manage_member' => PermissionMap::allows($viewerRole, 'team.manage')
                && (int) $viewer->getKey() !== (int) $staff->user_id
                && $staff->status !== 'removed',
        ];
    }

    private function ownerData(Restaurant $restaurant, User $viewer): array
    {
        $owner = $restaurant->owner;
        $viewerRole = $viewer->restaurantMembership($restaurant)['role'] ?? 'staff';

        return [
            'id' => 'owner-'.$restaurant->getKey(),
            'user_id' => (string) $restaurant->owner_user_id,
            'name' => $owner?->name,
            'email' => $viewerRole === 'manager' ? $this->maskEmail((string) $owner?->email) : $owner?->email,
            'position' => 'owner',
            'position_name' => self::POSITIONS['owner']['name'],
            'status' => 'active',
            'joined_at' => $restaurant->created_at?->toISOString(),
            'last_active_at' => $owner?->last_login_at?->toISOString(),
            'permissions' => PermissionMap::forRole('owner'),
            'can_manage_member' => false,
        ];
    }

    private function invitationData(Invitation $invitation, User $viewer, ?string $token = null): array
    {
        $viewerRole = $viewer->restaurantMembership($invitation->restaurant)['role'] ?? 'staff';
        $data = [
            'id' => (string) $invitation->getKey(),
            'user_id' => (string) $invitation->user_id,
            'name' => $invitation->user?->name,
            'email' => $viewerRole === 'manager' ? $this->maskEmail($invitation->invited_email) : $invitation->invited_email,
            'position' => $invitation->staff_role,
            'status' => $invitation->status,
            'expires_at' => $invitation->expires_at?->toISOString(),
        ];
        if ($token !== null && app()->environment(['local', 'testing'])) {
            $action = $invitation->user?->status === 'invited' ? 'activate' : 'accept';
            $data['invite_path'] = '/team-invitations/'.$token.'/'.$action;
        }

        return $data;
    }

    private function deliverInvitation(Invitation $invitation, string $token): void
    {
        $action = $invitation->user?->status === 'invited' ? 'activate' : 'accept';
        $link = rtrim((string) config('salo.frontend_url'), '/').'/team-invitations/'.$token.'/'.$action;
        $restaurantName = $invitation->restaurant?->name ?? 'a restaurant';
        $message = $action === 'activate'
            ? "You have been invited to join {$restaurantName} as a {$invitation->staff_role}. Set your name and password using this single-use link: {$link}"
            : "You have been invited to join {$restaurantName} as a {$invitation->staff_role}. Sign in to your SALO account, then accept using this single-use link: {$link}";
        BusinessNotification::query()->create([
            'user_id' => $invitation->user_id,
            'type' => 'team.invitation',
            'message' => "You have been invited to join {$restaurantName} as a {$invitation->staff_role}.",
            'related_reference' => 'invitation:'.$invitation->getKey(),
            'created_at' => now(),
        ]);

        Mail::raw($message, function ($mail) use ($invitation, $restaurantName): void {
            $mail->to($invitation->invited_email)
                ->subject("Invitation to join {$restaurantName} on SALO");
        });
    }

    private function pendingName(?string $name): array
    {
        $parts = preg_split('/\s+/', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if ($parts === []) {
            return ['Pending', 'Invitee'];
        }

        $first = array_shift($parts);
        $last = $parts === [] ? 'Invitee' : implode(' ', $parts);
        if (mb_strlen($first) > 80 || mb_strlen($last) > 80) {
            throw ValidationException::withMessages([
                'invitee_name' => ['The first and last names must each be 80 characters or fewer.'],
            ]);
        }

        return [$first, $last];
    }

    private function matchesOwnerFilters(Restaurant $restaurant, array $filters, bool $searchEmail): bool
    {
        if (! empty($filters['position']) && $filters['position'] !== 'owner') {
            return false;
        }
        if (! empty($filters['status']) && $filters['status'] !== 'active') {
            return false;
        }
        if (! empty($filters['search'])) {
            $owner = $restaurant->owner;
            $search = mb_strtolower((string) $filters['search']);
            if (! str_contains(mb_strtolower((string) $owner?->name), $search)
                && (! $searchEmail || ! str_contains(mb_strtolower((string) $owner?->email), $search))) {
                return false;
            }
        }

        return true;
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($local === '' || $domain === '') {
            return '•••';
        }

        return mb_substr($local, 0, 1).'•••@'.$domain;
    }

    private function record(
        User $actor,
        Restaurant $restaurant,
        string $action,
        string $entityType,
        ?string $entityId,
        ?array $before,
        ?array $after,
    ): void {
        $this->audit->record([
            'actor_user_id' => $actor->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }
}
