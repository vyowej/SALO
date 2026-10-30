<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\PlatformAdmin;
use App\Models\Restaurant;
use App\Models\RestaurantStaff;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TeamAndAuditTest extends TestCase
{
    public function test_new_invitee_sets_name_and_password_and_the_invitation_is_single_use(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $this->app['env'] = 'local';

        $response = $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/team/invitations'), [
                'email' => 'new.invitee@example.test',
                'position' => 'staff',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.position', 'staff')
            ->assertJsonMissingPath('data.password');

        $invitePath = $response->json('data.invite_path');
        $token = explode('/', (string) $invitePath)[2] ?? '';
        $this->assertNotSame('', $token);

        $invitation = \App\Models\Invitation::query()->firstOrFail();
        $this->assertSame(hash('sha256', $token), $invitation->token_hash);
        $this->assertDatabaseHas('users', [
            'email' => 'new.invitee@example.test',
            'status' => 'invited',
            'first_name' => 'Pending',
            'last_name' => 'Invitee',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $invitation->user_id,
            'type' => 'team.invitation',
        ]);
        $this->assertDatabaseHas('restaurant_staff', [
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $invitation->user_id,
            'staff_role' => 'staff',
            'status' => 'invited',
        ]);

        Auth::logout();
        $this->postJson('/api/v1/team-invitations/'.$token.'/activate', [
            'first_name' => 'Alex',
            'last_name' => 'Rivera',
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ])->assertOk()->assertJsonPath('data.position', 'staff');

        $invitee = User::query()->where('email', 'new.invitee@example.test')->firstOrFail();
        $this->assertSame('active', $invitee->status);
        $this->assertSame('Alex Rivera', $invitee->name);
        $this->assertTrue(Hash::check('NewPass123', $invitee->getAuthPassword()));
        $this->assertDatabaseHas('invitations', ['id' => $invitation->getKey(), 'status' => 'accepted']);
        $this->assertDatabaseHas('restaurant_staff', [
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $invitee->getKey(),
            'status' => 'active',
        ]);

        $this->postJson('/api/v1/team-invitations/'.$token.'/activate', [
            'first_name' => 'Alex',
            'last_name' => 'Rivera',
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ])->assertNotFound();
    }

    public function test_existing_invitation_requires_matching_authenticated_account_and_is_single_use(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $invitee = $this->createUser('member@example.test');
        $this->app['env'] = 'local';

        $response = $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/team/invitations'), [
                'email' => $invitee->email,
                'position' => 'manager',
            ])
            ->assertOk();
        $token = explode('/', (string) $response->json('data.invite_path'))[2] ?? '';
        $this->assertNotSame('', $token);

        $wrongAccount = $this->createUser('wrong@example.test');
        $this->actingAs($wrongAccount, 'web')
            ->postJson('/api/v1/team-invitations/'.$token.'/accept')
            ->assertForbidden();

        $this->actingAs($invitee, 'web')
            ->postJson('/api/v1/team-invitations/'.$token.'/accept')
            ->assertOk()
            ->assertJsonPath('data.position', 'manager');
        $this->assertDatabaseHas('restaurant_staff', [
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $invitee->getKey(),
            'status' => 'active',
        ]);
        $this->actingAs($invitee, 'web')
            ->postJson('/api/v1/team-invitations/'.$token.'/accept')
            ->assertNotFound();
    }

    public function test_activated_invitee_can_accept_another_pending_restaurant_invitation(): void
    {
        [$firstOwner, $firstRestaurant] = $this->createOwnerAndRestaurant();
        $secondOwner = $this->createUser('second.owner@example.test');
        $secondRestaurant = Restaurant::query()->create([
            'owner_user_id' => $secondOwner->getKey(),
            'name' => 'Second Team Restaurant',
            'status' => 'approved',
        ]);
        $this->app['env'] = 'local';
        $email = 'multi.restaurant@example.test';
        $firstInvite = $this->businessRequest($firstOwner, $firstRestaurant)
            ->postJson($this->path($firstRestaurant, '/team/invitations'), ['email' => $email, 'position' => 'staff'])
            ->assertOk();
        $secondInvite = $this->businessRequest($secondOwner, $secondRestaurant)
            ->postJson($this->path($secondRestaurant, '/team/invitations'), ['email' => $email, 'position' => 'manager'])
            ->assertOk();
        $firstToken = explode('/', (string) $firstInvite->json('data.invite_path'))[2] ?? '';
        $secondToken = explode('/', (string) $secondInvite->json('data.invite_path'))[2] ?? '';

        Auth::logout();
        $this->postJson('/api/v1/team-invitations/'.$firstToken.'/activate', [
            'first_name' => 'Alex',
            'last_name' => 'Rivera',
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ])->assertOk();

        $invitee = User::query()->where('email', $email)->firstOrFail();
        $this->actingAs($invitee, 'web')
            ->postJson('/api/v1/team-invitations/'.$secondToken.'/accept')
            ->assertOk()
            ->assertJsonPath('data.position', 'manager');
        $this->assertSame(2, RestaurantStaff::query()
            ->where('user_id', $invitee->getKey())
            ->where('status', 'active')
            ->count());
    }

    public function test_manager_can_view_masked_team_but_cannot_manage_or_read_audit(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $manager = $this->createUser('manager@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $manager->getKey(),
            'staff_role' => 'manager',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $this->businessRequest($manager, $restaurant)
            ->getJson($this->path($restaurant, '/team'))
            ->assertOk()
            ->assertJsonPath('data.can_manage', false)
            ->assertJsonFragment(['email' => 'o•••@example.test']);

        $this->businessRequest($manager, $restaurant)
            ->getJson($this->path($restaurant, '/team?search=owner@example.test'))
            ->assertOk()
            ->assertJsonCount(0, 'data.members.data');

        $this->businessRequest($manager, $restaurant)
            ->postJson($this->path($restaurant, '/team/email-check'), ['email' => 'person@example.test'])
            ->assertForbidden();
        $this->businessRequest($manager, $restaurant)
            ->getJson($this->path($restaurant, '/audit'))
            ->assertForbidden();

        $this->assertDatabaseMissing('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'team.email_checked',
        ]);
    }

    public function test_owner_is_a_single_virtual_team_row_across_paginated_pages(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $staff = $this->createUser('staff@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $staff->getKey(),
            'staff_role' => 'staff',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->businessRequest($owner, $restaurant)
            ->getJson($this->path($restaurant, '/team?per_page=1&page=1'))
            ->assertOk()
            ->assertJsonPath('data.members.meta.total', 2)
            ->assertJsonPath('data.members.meta.last_page', 2)
            ->assertJsonPath('data.members.data.0.position', 'owner')
            ->assertJsonCount(1, 'data.members.data');

        $this->businessRequest($owner, $restaurant)
            ->getJson($this->path($restaurant, '/team?per_page=1&page=2'))
            ->assertOk()
            ->assertJsonPath('data.members.data.0.position', 'staff')
            ->assertJsonCount(1, 'data.members.data');
    }

    public function test_cancelling_invitation_removes_membership_and_allows_reinviting_same_account(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $payload = ['email' => 'invitee@example.test', 'position' => 'staff'];
        $response = $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/team/invitations'), $payload)
            ->assertOk();
        $invitationId = $response->json('data.id');
        $invitee = User::query()->where('email', $payload['email'])->firstOrFail();

        $this->businessRequest($owner, $restaurant)
            ->deleteJson($this->path($restaurant, '/team/invitations/'.$invitationId))
            ->assertNoContent();

        $this->assertDatabaseHas('invitations', ['id' => $invitationId, 'status' => 'cancelled']);
        $this->assertDatabaseHas('restaurant_staff', [
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $invitee->getKey(),
            'status' => 'removed',
        ]);

        $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/team/invitations'), $payload)
            ->assertOk();

        $this->assertSame(1, RestaurantStaff::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('user_id', $invitee->getKey())
            ->count());
        $this->assertSame(2, \App\Models\Invitation::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('user_id', $invitee->getKey())
            ->count());
    }

    public function test_expired_invitation_is_not_resent_and_its_membership_is_removed(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $response = $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/team/invitations'), [
                'email' => 'expired.invitee@example.test',
                'position' => 'staff',
            ])
            ->assertOk();
        $invitationId = $response->json('data.id');
        $invitation = \App\Models\Invitation::query()->findOrFail($invitationId);
        $invitation->expires_at = now()->subMinute();
        $invitation->save();

        $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/team/invitations/'.$invitationId.'/resend'))
            ->assertNotFound();

        $this->assertDatabaseHas('invitations', ['id' => $invitationId, 'status' => 'expired']);
        $this->assertDatabaseHas('restaurant_staff', [
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $invitation->user_id,
            'status' => 'removed',
        ]);
    }

    public function test_owner_can_transfer_ownership_to_an_active_manager_atomically(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $manager = $this->createUser('manager@example.test');
        $staff = RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $manager->getKey(),
            'staff_role' => 'manager',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/team/transfer-ownership'), [
                'manager_id' => $manager->getKey(),
                'password' => 'Password123',
            ])
            ->assertOk()
            ->assertJsonPath('data.owner_user_id', (string) $manager->getKey());

        $this->assertSame((int) $manager->getKey(), (int) $restaurant->fresh()->owner_user_id);
        $this->assertSame('removed', $staff->fresh()->status);
        $formerOwnerMembership = RestaurantStaff::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('user_id', $owner->getKey())
            ->firstOrFail();
        $this->assertSame('manager', $formerOwnerMembership->staff_role);
        $this->assertSame('active', $formerOwnerMembership->status);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'ownership.transferred',
        ]);
    }

    public function test_admin_can_reassign_ownership_with_reason(): void
    {
        [, $restaurant] = $this->createOwnerAndRestaurant();
        $manager = $this->createUser('manager@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $manager->getKey(),
            'staff_role' => 'manager',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $admin = $this->createUser('admin@example.test');
        PlatformAdmin::query()->create([
            'user_id' => $admin->getKey(),
            'admin_level' => 'super',
            'status' => 'active',
        ]);

        $this->actingAs($admin, 'web')
            ->withSession(['salo.active_mode' => 'admin'])
            ->postJson('/api/v1/admin/restaurants/'.$restaurant->getKey().'/transfer-ownership', [
                'manager_id' => $manager->getKey(),
                'reason' => 'Ownership requested by the restaurant.',
            ])
            ->assertOk()
            ->assertJsonPath('data.owner_user_id', (string) $manager->getKey());
    }

    public function test_removed_or_suspended_members_receive_forbidden_but_unrelated_users_remain_hidden(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $this->assertTrue($owner->hasRestaurantMembership($restaurant));
        $member = $this->createUser('member@example.test');
        $staff = RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $member->getKey(),
            'staff_role' => 'staff',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $this->assertTrue($member->hasRestaurantMembership($restaurant));
        $secondRestaurant = Restaurant::query()->create([
            'owner_user_id' => $owner->getKey(),
            'name' => 'Another Restaurant',
            'status' => 'approved',
        ]);

        $this->businessRequest($owner, $restaurant)
            ->getJson($this->path($restaurant, '/business'))
            ->assertOk();
        $this->businessRequest($owner, $secondRestaurant)
            ->getJson($this->path($secondRestaurant, '/business'))
            ->assertOk();

        $this->businessRequest($member, $restaurant)
            ->getJson($this->path($restaurant, '/business'))
            ->assertOk();
        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->path($restaurant, '/team/'.$staff->getKey()), ['status' => 'suspended'])
            ->assertOk();
        $this->businessRequest($member, $restaurant)
            ->getJson($this->path($restaurant, '/business'))
            ->assertForbidden();

        $this->businessRequest($member, $secondRestaurant)
            ->getJson($this->path($secondRestaurant, '/business'))
            ->assertNotFound();
    }

    public function test_owner_audit_is_paginated_and_scoped_to_the_restaurant(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        AuditLog::query()->create([
            'actor_user_id' => $owner->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'team.member_removed',
            'entity_type' => 'restaurant_staff',
            'entity_id' => '12',
            'before_value' => ['status' => 'active'],
            'after_value' => ['status' => 'removed'],
            'created_at' => now(),
        ]);

        $this->businessRequest($owner, $restaurant)
            ->getJson($this->path($restaurant, '/audit?search=member_removed&per_page=1'))
            ->assertOk()
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('data.0.action', 'team.member_removed');
    }

    private function createOwnerAndRestaurant(): array
    {
        $owner = $this->createUser('owner@example.test');
        $restaurant = Restaurant::query()->create([
            'owner_user_id' => $owner->getKey(),
            'name' => 'Team Test Restaurant',
            'status' => 'approved',
        ]);

        return [$owner, $restaurant];
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password' => 'Password123',
            'first_name' => 'Team',
            'last_name' => 'Member',
            'status' => 'active',
        ]);
    }

    private function businessRequest(User $user, Restaurant $restaurant): self
    {
        return $this->actingAs($user, 'web')
            ->withSession([
                'salo.active_mode' => 'business',
                'salo.selected_restaurant_id' => (string) $restaurant->getKey(),
            ])
            ->withHeaders([
                'X-SALO-Mode' => 'business',
                'X-SALO-Restaurant' => (string) $restaurant->getKey(),
            ]);
    }

    private function path(Restaurant $restaurant, string $suffix): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().$suffix;
    }
}
