<?php

namespace App\Repositories\Contracts;

use App\Models\Invitation;
use App\Models\Restaurant;
use App\Models\RestaurantStaff;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface TeamRepository
{
    public function paginateMembers(Restaurant $restaurant, array $filters, ?int $offset = null, ?int $limit = null): LengthAwarePaginator;

    public function pendingInvitations(Restaurant $restaurant): Collection;

    public function activeMembers(Restaurant $restaurant): Collection;

    public function findUserByEmail(string $email): ?User;

    public function createInvitedUser(array $attributes): User;

    public function staffForUpdate(Restaurant $restaurant, User $user): ?RestaurantStaff;

    public function staffByIdForUpdate(Restaurant $restaurant, int $staffId): ?RestaurantStaff;

    public function staffByUserIdForUpdate(Restaurant $restaurant, int $userId): ?RestaurantStaff;

    public function staffForInvitation(Restaurant $restaurant, User $user): RestaurantStaff;

    public function pendingInvitationByEmailForUpdate(Restaurant $restaurant, string $email): ?Invitation;

    public function invitationForUpdateByHash(string $tokenHash): ?Invitation;

    public function invitationByIdForUpdate(Restaurant $restaurant, int $invitationId): ?Invitation;

    public function createInvitation(array $attributes): Invitation;

    public function saveInvitation(Invitation $invitation): Invitation;

    public function cancelPendingInvitationsForMember(Restaurant $restaurant, int $userId): int;

    public function dueInvitations(?Restaurant $restaurant = null): Collection;

    public function restaurantForUpdate(int $restaurantId): ?Restaurant;

    public function saveRestaurant(Restaurant $restaurant): Restaurant;
}
