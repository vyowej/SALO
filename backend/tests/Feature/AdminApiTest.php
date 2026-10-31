<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\RestaurantApplication;
use App\Repositories\Contracts\AdminRepository;
use App\Repositories\Contracts\UserRepository;
use App\Repositories\Stub\AdminFixtures;
use App\Services\AdminService;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
        app(AdminRepository::class)->reset();
    }

    public function test_admin_routes_require_authentication(): void
    {
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();
    }

    public function test_customer_cannot_access_admin_routes(): void
    {
        $this->actingAs($this->user(['customer']), 'web')
            ->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }

    public function test_admin_capability_can_access_admin_routes(): void
    {
        $this->actingAs($this->user(['customer', 'admin']), 'web')
            ->withSession(['salo.active_mode' => 'admin'])
            ->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonStructure(['data' => ['totals', 'orders_per_day']]);
    }

    public function test_dashboard_and_users_list_return_contract_shapes_and_validate_pagination(): void
    {
        $this->asAdmin();
        $this->getJson('/api/v1/admin/users?capability=customer&per_page=2')
            ->assertOk()->assertJsonStructure(['data', 'meta' => ['current_page', 'per_page', 'total', 'last_page']])
            ->assertJsonPath('meta.per_page', 2);
        $this->getJson('/api/v1/admin/users?per_page=invalid')->assertUnprocessable();
    }

    public function test_user_create_update_enforce_capabilities_and_owner_driver_rule(): void
    {
        $this->asAdmin();
        $this->postJson('/api/v1/admin/users', ['name' => 'New Sample', 'email' => 'new@example.test', 'capabilities' => ['customer'], 'password' => 'Password123'])
            ->assertOk()->assertJsonPath('data.capabilities', ['customer'])
            ->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.password_hash');
        $this->postJson('/api/v1/admin/users', ['name' => 'Bad Sample', 'email' => 'bad@example.test', 'capabilities' => ['owner'], 'password' => 'Password123'])
            ->assertUnprocessable();
        $this->putJson('/api/v1/admin/users/'.AdminFixtures::id(102), ['capabilities' => ['customer', 'driver']])
            ->assertUnprocessable();
        $this->expectException(ValidationException::class);
        app(AdminService::class)->create('users', [
            'name' => 'Conflict User', 'email' => 'conflict@example.test',
            'capabilities' => ['customer', 'driver'], 'memberships' => [['role' => 'owner']],
        ], $this->user(['customer', 'admin']));
    }

    public function test_restaurant_and_application_writes_apply_contract_rules(): void
    {
        $this->asAdmin();
        $this->postJson('/api/v1/admin/restaurants', [])->assertUnprocessable();
        $applicant = $this->user(['customer']);
        $application = RestaurantApplication::query()->create([
            'submitted_by' => $applicant->getKey(),
            'application_type' => 'initial',
            'status' => 'under_review',
            'draft_details' => [
                'restaurant_name' => 'Sample Business 1',
                'business_email' => 'business@example.test',
                'psgc_code' => null,
                'street' => null,
                'latitude' => null,
                'longitude' => null,
            ],
            'submitted_at' => now(),
        ]);
        $appId = $application->getKey();
        $this->postJson("/api/v1/admin/applications/partner/{$appId}/approve", [])
            ->assertOk()->assertJsonPath('data.status', 'approved');
        $this->assertDatabaseHas('restaurants', ['name' => 'Sample Business 1', 'status' => 'approved']);
        $this->getJson('/api/v1/admin/restaurants?status=active')->assertOk()
            ->assertJsonFragment(['name' => 'Sample Restaurant 1', 'status' => 'active']);
        $this->postJson('/api/v1/admin/applications/rider/'.AdminFixtures::id(304).'/reject', [])
            ->assertUnprocessable();
    }

    public function test_rider_application_approval_grants_driver_capability_and_rejects_owner_conflict(): void
    {
        $this->asAdmin();
        $repository = app(AdminRepository::class);
        $applicantId = AdminFixtures::id(112);
        $applicant = $repository->find('users', $applicantId);
        $repository->update('users', $applicantId, ['memberships' => [['restaurant_id' => AdminFixtures::id(201), 'role' => 'owner', 'status' => 'active']]]);
        $this->postJson('/api/v1/admin/applications/rider/'.AdminFixtures::id(304).'/approve', [])
            ->assertUnprocessable();
        $repository->update('users', $applicantId, ['memberships' => []]);
        $this->postJson('/api/v1/admin/applications/rider/'.AdminFixtures::id(304).'/approve', [])
            ->assertOk()->assertJsonPath('data.status', 'approved');
        self::assertContains('driver', $repository->find('users', $applicantId)['capabilities']);
        self::assertNotNull($applicant);
    }

    public function test_rider_status_and_proofs_endpoints_work_and_validate_status(): void
    {
        $this->asAdmin();
        $id = AdminFixtures::id(103);
        $this->getJson('/api/v1/admin/riders')->assertOk();
        $this->getJson("/api/v1/admin/riders/{$id}/proofs")->assertOk()->assertJsonStructure(['data']);
        $this->patchJson("/api/v1/admin/riders/{$id}/status", ['status' => 'offline'])->assertUnprocessable();
        $this->patchJson("/api/v1/admin/riders/{$id}/status", ['status' => 'suspended'])->assertOk()->assertJsonPath('data.status', 'suspended');
    }

    public function test_order_cancel_happy_path_and_invalid_terminal_status(): void
    {
        $this->asAdmin();
        $placed = AdminFixtures::id(502);
        $this->postJson("/api/v1/admin/orders/{$placed}/cancel", ['reason' => 'Restaurant unavailable'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.cancelled_by', 'admin')
            ->assertJsonPath('data.cancel_reason', 'Restaurant unavailable')
            ->assertJsonCount(2, 'data.status_history');
        $this->postJson('/api/v1/admin/orders/'.AdminFixtures::id(501).'/cancel', ['reason' => 'Too late'])
            ->assertUnprocessable();
        $this->postJson('/api/v1/admin/orders/'.AdminFixtures::id(503).'/cancel', [])->assertUnprocessable();
        $this->getJson('/api/v1/admin/history?subject_type=order')
            ->assertOk()->assertJsonPath('data.0.action', 'cancelled');
    }

    public function test_reservation_status_happy_path_and_invalid_transition(): void
    {
        $this->asAdmin();
        $pending = AdminFixtures::id(601);
        $this->patchJson("/api/v1/admin/reservations/{$pending}/status", ['status' => 'confirmed'])
            ->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->patchJson('/api/v1/admin/reservations/'.AdminFixtures::id(604).'/status', ['status' => 'cancelled', 'reason' => 'Customer request'])
            ->assertUnprocessable();
        $this->patchJson('/api/v1/admin/reservations/'.AdminFixtures::id(602).'/status', ['status' => 'cancelled'])
            ->assertUnprocessable();
        $this->patchJson('/api/v1/admin/reservations/'.AdminFixtures::id(602).'/status', ['status' => 'cancelled', 'reason' => 'Customer request'])
            ->assertOk()->assertJsonPath('data.cancel_reason', 'Customer request');
    }

    public function test_reports_history_calendar_settings_areas_and_schedules(): void
    {
        $this->asAdmin();
        $this->getJson('/api/v1/admin/reports/sales')->assertOk();
        $this->getJson('/api/v1/admin/reports/sales?period=year')->assertUnprocessable();
        $this->getJson('/api/v1/admin/history')->assertOk();
        $this->getJson('/api/v1/admin/history?per_page=101')->assertUnprocessable();
        $this->getJson('/api/v1/admin/calendar?from=2026-10-30&to=2026-10-31')->assertOk();
        $this->getJson('/api/v1/admin/calendar?from=invalid')->assertUnprocessable();
        $this->getJson('/api/v1/admin/settings')->assertOk();
        $this->putJson('/api/v1/admin/settings', ['max_riders_per_area' => 0])->assertUnprocessable();
        $this->putJson('/api/v1/admin/settings', ['max_riders_per_area' => 20])->assertOk();
        $this->getJson('/api/v1/admin/service-areas')->assertOk();
        $this->postJson('/api/v1/admin/service-areas', ['name' => 'Invalid', 'city_code' => '0972200000', 'latitude' => 200, 'longitude' => 122, 'max_riders' => 1])->assertUnprocessable();
        $this->postJson('/api/v1/admin/service-areas', ['name' => 'Sample Area', 'city_code' => '0972200000', 'latitude' => 6.9, 'longitude' => 122, 'max_riders' => 2])->assertOk();
        $this->getJson('/api/v1/admin/schedules?date=2026-10-30')->assertOk();
        $this->postJson('/api/v1/admin/schedules/generate', [])->assertUnprocessable();
        $this->postJson('/api/v1/admin/schedules/generate', ['date' => '2026-12-01'])->assertOk();
    }

    private function asAdmin(): void
    {
        $this->actingAs($this->user(['customer', 'admin']), 'web')
            ->withSession(['salo.active_mode' => 'admin']);
    }

    private function user(array $capabilities): User
    {
        return app(UserRepository::class)->create([
            'name' => 'Test Admin', 'email' => uniqid('admin-', true).'@example.test',
            'status' => 'active', 'capabilities' => $capabilities, 'memberships' => [],
            'email_verified_at' => null, 'password_hash' => Hash::make('Password123'),
        ]);
    }
}
