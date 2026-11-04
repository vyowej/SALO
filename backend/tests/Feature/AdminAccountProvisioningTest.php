<?php

namespace Tests\Feature;

use App\Models\PlatformAdmin;
use App\Models\User;
use App\Repositories\Stub\AdminFixtures;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthoritativeFixtures;
use Tests\TestCase;

class AdminAccountProvisioningTest extends TestCase
{
    use AuthoritativeFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ]);
    }

    public function test_interactive_command_creates_first_admin_with_a_hashed_password(): void
    {
        $this->artisan('salo:admin-provision')
            ->expectsQuestion('Admin name', 'Initial Admin')
            ->expectsQuestion('Admin email address', 'initial-admin@example.test')
            ->expectsQuestion('Password', 'Password123')
            ->expectsQuestion('Confirm password', 'Password123')
            ->expectsOutputToContain('Initial Admin account provisioned.')
            ->assertSuccessful();

        $user = User::query()->where('email', 'initial-admin@example.test')->firstOrFail();
        $this->assertSame('Initial Admin', $user->name);
        $this->assertTrue(Hash::check('Password123', $user->password_hash));
        $this->assertNotSame('Password123', $user->password_hash);
        $this->assertSame('active', $user->platformAdmin()->firstOrFail()->status);
    }

    public function test_command_refuses_to_provision_again_or_when_only_suspended_admins_exist(): void
    {
        $existing = $this->createAdmin('existing-admin@example.test');
        $this->artisan('salo:admin-provision')
            ->expectsQuestion('Admin name', 'Another Admin')
            ->expectsQuestion('Admin email address', 'another-admin@example.test')
            ->expectsQuestion('Password', 'Password123')
            ->expectsQuestion('Confirm password', 'Password123')
            ->expectsOutputToContain('An Admin record already exists.')
            ->assertFailed();
        $this->assertSame(1, PlatformAdmin::query()->count());
        $this->assertDatabaseMissing('users', ['email' => 'another-admin@example.test']);

        $existing->platformAdmin()->update(['status' => 'suspended']);
        $this->artisan('salo:admin-provision')
            ->expectsQuestion('Admin name', 'Replacement Admin')
            ->expectsQuestion('Admin email address', 'replacement-admin@example.test')
            ->expectsQuestion('Password', 'Password123')
            ->expectsQuestion('Confirm password', 'Password123')
            ->expectsOutputToContain('An Admin record already exists.')
            ->assertFailed();
        $this->assertSame(1, PlatformAdmin::query()->count());
    }

    public function test_registration_rejects_admin_role_assignment(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Self Admin',
            'email' => 'self-admin@example.test',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'capabilities' => ['customer', 'admin'],
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('users', ['email' => 'self-admin@example.test']);
    }

    public function test_admin_account_management_requires_authentication_and_rejects_customers(): void
    {
        $this->getJson('/api/v1/admin/admin-accounts')->assertUnauthorized();

        $customer = $this->createUser('ordinary@example.test');
        $this->actingAs($customer, 'web')
            ->withSession(['salo.active_mode' => 'customer'])
            ->getJson('/api/v1/admin/admin-accounts')
            ->assertForbidden();
    }

    public function test_sellers_cannot_access_admin_account_management(): void
    {
        $seller = $this->createUser('seller@example.test');
        $this->createAuthoritativeRestaurant($seller);
        $this->actingAs($seller, 'web')
            ->withSession(['salo.active_mode' => 'business'])
            ->postJson('/api/v1/admin/admin-accounts', [])
            ->assertForbidden();
    }

    public function test_authorized_admin_can_create_edit_deactivate_and_reactivate_accounts(): void
    {
        $actor = $this->createAdmin('managing-admin@example.test');
        $this->asAdmin($actor);

        $this->postJson('/api/v1/admin/admin-accounts', [
            'name' => 'Duplicate Admin',
            'email' => 'managing-admin@example.test',
            'password' => 'SecurePassword123',
            'password_confirmation' => 'SecurePassword123',
        ])->assertUnprocessable();

        $created = $this->postJson('/api/v1/admin/admin-accounts', [
            'name' => 'Second Admin',
            'email' => 'second-admin@example.test',
            'phone' => '09123456789',
            'password' => 'SecurePassword123',
            'password_confirmation' => 'SecurePassword123',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'Second Admin')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.password_hash');

        $id = $created->json('data.id');
        $user = User::query()->findOrFail($id);
        $this->assertTrue(Hash::check('SecurePassword123', $user->password_hash));
        $this->assertNotSame('SecurePassword123', $user->password_hash);

        $this->getJson('/api/v1/admin/admin-accounts')
            ->assertOk()
            ->assertJsonFragment(['email' => 'second-admin@example.test']);
        $this->getJson('/api/v1/admin/admin-accounts/'.$id)
            ->assertOk()
            ->assertJsonPath('data.phone', '09123456789');

        $this->putJson('/api/v1/admin/admin-accounts/'.$id, [
            'name' => 'Updated Admin',
            'email' => 'updated-admin@example.test',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Updated Admin')
            ->assertJsonPath('data.email', 'updated-admin@example.test');

        $this->patchJson('/api/v1/admin/admin-accounts/'.$id.'/status', ['status' => 'suspended'])
            ->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->assertSame('active', $user->fresh()->status);
        $this->assertSame(['customer'], $user->fresh()->capabilities);

        $this->patchJson('/api/v1/admin/admin-accounts/'.$id.'/status', ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.status', 'active');
        $this->assertSame(2, PlatformAdmin::query()->where('status', 'active')->count());
        $this->assertSame(['customer', 'admin'], $user->fresh()->capabilities);

        $this->postJson('/api/v1/auth/logout')->assertOk();
        Auth::forgetGuards();
        $this->postJson('/api/v1/auth/login', [
            'email' => 'updated-admin@example.test',
            'password' => 'SecurePassword123',
        ])->assertOk()->assertJsonPath('data.capabilities', ['customer', 'admin']);
    }

    public function test_last_active_admin_is_protected_from_admin_and_generic_mutations(): void
    {
        $admin = $this->createAdmin('last-admin@example.test');
        $this->asAdmin($admin);

        $this->patchJson('/api/v1/admin/admin-accounts/'.$admin->getKey().'/status', ['status' => 'suspended'])
            ->assertUnprocessable();
        $this->assertSame('active', $admin->platformAdmin()->firstOrFail()->status);

        $this->withSession(['salo.active_mode' => 'customer'])
            ->deleteJson('/api/v1/customer/profile', ['password' => 'Password123'])
            ->assertUnprocessable();
        $this->assertSame('active', $admin->fresh()->status);
        $this->withSession(['salo.active_mode' => 'admin']);

        $this->postJson('/api/v1/admin/users', [
            'name' => 'Generic Admin',
            'email' => 'generic-admin@example.test',
            'capabilities' => ['customer', 'admin'],
            'password' => 'Password123',
        ])->assertUnprocessable();

        $this->postJson('/api/v1/admin/users/'.AdminFixtures::id(101).'/suspend', [
            'reason' => 'Attempt generic Admin suspension',
        ])->assertUnprocessable();
        $this->deleteJson('/api/v1/admin/users/'.AdminFixtures::id(101))
            ->assertUnprocessable();
        $this->assertSame(1, PlatformAdmin::query()->count());
    }

    public function test_admin_can_be_deactivated_when_another_active_admin_remains(): void
    {
        $actor = $this->createAdmin('first-active-admin@example.test');
        $target = $this->createAdmin('second-active-admin@example.test');
        $this->asAdmin($actor);

        $this->patchJson('/api/v1/admin/admin-accounts/'.$target->getKey().'/status', ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertSame('active', $actor->platformAdmin()->firstOrFail()->status);
        $this->assertSame('suspended', $target->platformAdmin()->firstOrFail()->status);
    }

    public function test_admin_can_deactivate_their_user_account_only_when_another_admin_remains(): void
    {
        $remainingAdmin = $this->createAdmin('remaining-admin@example.test');
        $selfDeactivatingAdmin = $this->createAdmin('self-deactivating-admin@example.test');
        $this->actingAs($selfDeactivatingAdmin, 'web')
            ->withSession(['salo.active_mode' => 'customer'])
            ->deleteJson('/api/v1/customer/profile', ['password' => 'Password123'])
            ->assertOk();

        $this->assertSame('active', $remainingAdmin->fresh()->platformAdmin()->firstOrFail()->status);
        $this->assertSame('suspended', $selfDeactivatingAdmin->fresh()->platformAdmin()->firstOrFail()->status);
        $this->assertSame('deactivated', $selfDeactivatingAdmin->fresh()->status);
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password_hash' => Hash::make('Password123'),
            'first_name' => 'Test',
            'last_name' => 'User',
            'status' => 'active',
        ]);
    }

    private function createAdmin(string $email): User
    {
        $user = $this->createUser($email);
        $user->platformAdmin()->create([
            'admin_level' => 'super',
            'status' => 'active',
        ]);

        return $user;
    }

    private function asAdmin(User $user): void
    {
        $this->actingAs($user, 'web')
            ->withSession(['salo.active_mode' => 'admin']);
    }
}
