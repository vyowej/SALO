<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Restaurant;
use App\Models\RestaurantApplication;
use App\Models\RestaurantStaff;
use App\Models\User;
use App\Models\PlatformAdmin;
use Tests\TestCase;

class RestaurantPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_owner_can_edit_normal_profile_and_the_change_is_audited(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->path($restaurant, '/profile'), [
                'name' => 'Updated Restaurant',
                'description' => 'A new public description.',
            ])
            ->assertOk()
            ->assertJsonPath('data.restaurant.name', 'Updated Restaurant')
            ->assertJsonPath('data.restaurant.description', 'A new public description.');

        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'profile.updated',
        ]);
    }

    public function test_sensitive_profile_changes_are_proposed_without_changing_live_values(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->path($restaurant, '/sensitive-profile'), [
                'proposed_changes' => ['legal_name' => 'New Legal Name'],
            ])
            ->assertOk()
            ->assertJsonPath('data.application_type', 'sensitive_update')
            ->assertJsonPath('data.status', 'submitted');

        $this->assertSame('Original Legal Name', $restaurant->fresh()->legal_name);
        $this->assertDatabaseHas('restaurant_applications', [
            'restaurant_id' => $restaurant->getKey(),
            'application_type' => 'sensitive_update',
            'status' => 'submitted',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'sensitive_update.submitted',
        ]);
    }

    public function test_another_user_cannot_read_or_edit_a_restaurant_page(): void
    {
        [, $restaurant] = $this->createOwnerAndRestaurant();
        $otherUser = $this->createUser('other@example.test');

        $this->businessRequest($otherUser, $restaurant)
            ->getJson($this->path($restaurant, '/profile'))
            ->assertNotFound();

        $this->businessRequest($otherUser, $restaurant)
            ->patchJson($this->path($restaurant, '/profile'), ['name' => 'Unauthorized'])
            ->assertNotFound();
    }

    public function test_owner_deactivation_is_audited_and_blocks_staff_access(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $staff = $this->createUser('staff-'.uniqid().'@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $staff->getKey(),
            'staff_role' => 'staff',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $restaurant->forceFill(['is_published' => true])->save();

        $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/deactivate'))
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.is_published', false);

        $this->assertSame('inactive', $restaurant->fresh()->status);
        $this->assertFalse((bool) $restaurant->fresh()->is_published);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'restaurant.deactivated',
        ]);

        $this->businessRequest($staff, $restaurant)
            ->getJson('/api/v1/manage/restaurants/'.$restaurant->getKey().'/business')
            ->assertForbidden();

        $this->businessRequest($owner, $restaurant)
            ->getJson('/api/v1/manage/restaurants/'.$restaurant->getKey().'/business')
            ->assertOk()
            ->assertJsonPath('data.restaurant.status', 'inactive')
            ->assertJsonPath('data.restaurant.is_read_only', true);
    }

    public function test_owner_can_reactivate_an_owner_deactivated_restaurant_but_it_stays_unpublished(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $restaurant->forceFill(['status' => 'inactive', 'is_published' => false])->save();

        $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/reactivate'))
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.is_published', false);

        $this->assertSame('approved', $restaurant->fresh()->status);
        $this->assertFalse((bool) $restaurant->fresh()->is_published);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'actor_user_id' => $owner->getKey(),
            'action' => 'restaurant.reactivated',
        ]);
    }

    public function test_owner_cannot_reactivate_a_restaurant_suspended_by_admin(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $restaurant->forceFill(['status' => 'suspended'])->save();

        $this->businessRequest($owner, $restaurant)
            ->postJson($this->path($restaurant, '/reactivate'))
            ->assertForbidden();

        $this->assertSame('suspended', $restaurant->fresh()->status);
    }

    public function test_publish_checklist_requires_a_published_orderable_menu_item(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $request = $this->businessRequest($owner, $restaurant);

        $request->getJson($this->path($restaurant, '/publish-checklist'))
            ->assertOk()
            ->assertJsonPath('data.checks.orderable_item.complete', false);

        $request->postJson($this->path($restaurant, '/publish'))
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['orderable_item']]]);

        $this->assertFalse((bool) $restaurant->fresh()->is_published);
    }

    public function test_admin_can_review_and_approve_a_sensitive_update_with_before_after_audit(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $admin = $this->createUser('admin-'.uniqid().'@example.test');
        PlatformAdmin::query()->create([
            'user_id' => $admin->getKey(),
            'admin_level' => 'super',
            'status' => 'active',
        ]);
        $application = RestaurantApplication::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'submitted_by' => $owner->getKey(),
            'application_type' => 'sensitive_update',
            'status' => 'submitted',
            'proposed_changes' => ['legal_name' => 'Approved Legal Name'],
            'submitted_at' => now(),
        ]);

        $this->actingAs($admin, 'web')
            ->withSession(['salo.active_mode' => 'admin'])
            ->postJson('/api/v1/admin/applications/restaurant/'.$application->getKey().'/start-review')
            ->assertOk()
            ->assertJsonPath('data.status', 'under_review');

        $this->postJson('/api/v1/admin/applications/restaurant/'.$application->getKey().'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertSame('Approved Legal Name', $restaurant->fresh()->legal_name);
        $audit = AuditLog::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('action', 'sensitive_update.approved')
            ->firstOrFail();
        $this->assertSame('Original Legal Name', $audit->before_value['legal_name']);
        $this->assertSame('Approved Legal Name', $audit->after_value['legal_name']);
    }

    private function createOwnerAndRestaurant(): array
    {
        $owner = $this->createUser('owner-'.uniqid().'@example.test');
        $restaurant = Restaurant::query()->create([
            'owner_user_id' => $owner->getKey(),
            'name' => 'Test Restaurant',
            'legal_name' => 'Original Legal Name',
            'status' => 'approved',
            'is_24_7' => true,
        ]);

        return [$owner, $restaurant];
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password_hash' => 'Password123',
            'first_name' => 'Business',
            'last_name' => 'Owner',
            'status' => 'active',
        ]);
    }

    private function businessRequest(User $user, Restaurant $restaurant): self
    {
        return $this->actingAs($user, 'sanctum')
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
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/business'.$suffix;
    }
}
