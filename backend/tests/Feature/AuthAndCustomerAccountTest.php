<?php

namespace Tests\Feature;

use App\Http\Authorization\PermissionMap;
use App\Models\User;
use App\Notifications\EmailVerificationNotification;
use App\Notifications\PasswordResetNotification;
use App\Repositories\Contracts\AddressRepository;
use App\Repositories\Contracts\UserRepository;
use App\Repositories\Stub\InMemoryAddressRepository;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthAndCustomerAccountTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ]);
        $this->app->bind(AddressRepository::class, InMemoryAddressRepository::class);
    }

    public function test_registration_grants_only_customer_capability_and_creates_primary_address(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Ava Santos',
            'email' => 'ava@example.test',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'address' => [
                'psgc_code' => null,
                'label' => 'Home',
                'address_type' => 'home',
                'street' => 'Main Road',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.capabilities', ['customer'])
            ->assertJsonPath('data.email', 'ava@example.test');

        $this->assertCount(1, app(AddressRepository::class)->allForUser($response->json('data.id')));
        $this->assertTrue(app(AddressRepository::class)->allForUser($response->json('data.id'))[0]['is_main']);
    }

    public function test_login_logout_and_current_account_endpoints_use_the_authenticated_user(): void
    {
        $this->createUser('login@example.test');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'login@example.test',
            'password' => 'Password123',
        ])->assertOk()->assertJsonPath('data.email', 'login@example.test');

        Auth::forgetGuards();
        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.capabilities', ['customer'])
            ->assertJsonPath('data.memberships', []);

        $this->postJson('/api/v1/auth/logout')->assertOk();
        Auth::forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_current_account_exposes_each_capability_and_effective_membership_permissions(): void
    {
        $user = $this->createUser('multi-capability@example.test', [
            'capabilities' => ['customer', 'driver'],
            'driver_state' => ['approval_status' => 'approved', 'availability_status' => 'available'],
            'memberships' => [[
                'restaurant_id' => 'restaurant-1',
                'role' => 'manager',
                'status' => 'active',
            ]],
        ]);
        $this->actingAs($user, 'web');

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.capabilities', ['customer', 'driver'])
            ->assertJsonPath('data.memberships.0.restaurant_id', 'restaurant-1')
            ->assertJsonPath('data.memberships.0.role', 'manager')
            ->assertJsonPath('data.memberships.0.permissions', PermissionMap::forRole('manager'))
            ->assertJsonPath('data.driver_state.availability_status', 'available');
    }

    public function test_profile_settings_and_address_operations_are_scoped_to_the_account(): void
    {
        $firstUser = $this->createUser('first@example.test');

        $this->actingAs($firstUser, 'web');
        $this->patchJson('/api/v1/customer/profile', ['name' => 'Updated Name', 'phone' => '555-0101'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Updated Name')
            ->assertJsonPath('data.phone', '555-0101');

        $this->getJson('/api/v1/customer/settings')
            ->assertOk()
            ->assertJsonPath('data.notifications', true)
            ->assertJsonPath('data.darkMode', false);
        $this->patchJson('/api/v1/customer/settings', ['promotions' => false, 'soundAlerts' => true])
            ->assertOk()
            ->assertJsonPath('data.promotions', false)
            ->assertJsonPath('data.soundAlerts', true);

        $address = [
            'psgc_code' => null,
            'label' => 'Home',
            'address_type' => 'home',
            'street' => 'Main Road',
        ];
        $created = $this->postJson('/api/v1/customer/addresses', $address)
            ->assertCreated()
            ->assertJsonPath('data.is_main', true);
        $this->assertNotEmpty($created->json('data.id'));

        $secondary = $this->postJson('/api/v1/customer/addresses', array_merge($address, [
            'label' => 'Work',
            'street' => 'Second Road',
        ]))->assertCreated()->assertJsonPath('data.is_main', false);
        $secondaryId = $secondary->json('data.id');

        $this->patchJson('/api/v1/customer/addresses/'.$secondaryId.'/primary')
            ->assertOk()
            ->assertJsonPath('data.is_main', true);
        $this->deleteJson('/api/v1/customer/addresses/'.$secondaryId)
            ->assertOk()
            ->assertJsonPath('data.deleted', true);
        $this->getJson('/api/v1/customer/addresses')
            ->assertOk()
            ->assertJsonPath('data.0.is_main', true);
    }

    public function test_customer_cannot_modify_an_address_owned_by_another_account(): void
    {
        $owner = $this->createUser('owner@example.test');
        $otherUser = $this->createUser('other@example.test');
        $address = app(AddressRepository::class)->create(
            (string) $owner->getAuthIdentifier(),
            [
                'psgc_code' => null,
                'label' => 'Home',
                'address_type' => 'home',
                'street' => 'Main Road',
            ],
        );
        $addressId = $address['id'];
        $this->assertNull(app(AddressRepository::class)->findForUser(
            (string) $otherUser->getAuthIdentifier(),
            $addressId,
        ));
        $this->actingAs($otherUser, 'web');

        $this->patchJson('/api/v1/customer/addresses/'.$addressId, ['street' => 'Other Road'])
            ->assertNotFound();
        $this->deleteJson('/api/v1/customer/addresses/'.$addressId)
            ->assertNotFound();
    }

    public function test_deactivation_requires_password_and_invalidates_access(): void
    {
        $user = $this->createUser('deactivate@example.test');
        $this->actingAs($user, 'web');

        $this->deleteJson('/api/v1/customer/profile', ['password' => 'incorrect'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->deleteJson('/api/v1/customer/profile', [
            'password' => 'Password123',
            'reason' => 'No longer needed',
        ])->assertOk();

        Auth::forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', [
            'email' => 'deactivate@example.test',
            'password' => 'Password123',
        ])->assertUnauthorized();
    }

    public function test_login_rejects_suspended_accounts_and_is_rate_limited(): void
    {
        $suspended = $this->createUser('suspended@example.test', ['status' => 'suspended']);
        $this->postJson('/api/v1/auth/login', [
            'email' => $suspended->email,
            'password' => 'Password123',
        ])->assertUnauthorized();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'throttled@example.test',
                'password' => 'incorrect',
            ])->assertUnauthorized();
        }

        $this->postJson('/api/v1/auth/login', [
            'email' => 'throttled@example.test',
            'password' => 'incorrect',
        ])->assertTooManyRequests()
            ->assertJsonPath('error.code', 'RATE_LIMITED');
    }

    public function test_password_reset_is_non_enumerating_and_consumes_its_token(): void
    {
        $user = $this->createUser('reset@example.test');
        Notification::fake();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'unknown@example.test'])
            ->assertOk()
            ->assertJsonPath('data.message', 'If this email has an account, you will receive a reset link shortly.');
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('data.message', 'If this email has an account, you will receive a reset link shortly.');

        $token = null;
        Notification::assertSentTo($user, PasswordResetNotification::class, function (PasswordResetNotification $notification) use (&$token): bool {
            $token = $notification->token;

            return true;
        });
        $this->assertNotNull($token);

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'NewPassword123',
            'password_confirmation' => 'NewPassword123',
        ])->assertOk();

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => $user->email,
            'token' => $token,
            'password' => 'AnotherPassword123',
            'password_confirmation' => 'AnotherPassword123',
        ])->assertUnprocessable();
    }

    public function test_email_verification_token_updates_the_current_account(): void
    {
        $user = $this->createUser('verify@example.test');
        Notification::fake();
        $this->actingAs($user, 'web');

        $this->postJson('/api/v1/auth/email/verification/send')
            ->assertOk()
            ->assertJsonPath('data.message', 'If verification is needed, a link will be sent to your email.');

        $token = null;
        Notification::assertSentTo($user, EmailVerificationNotification::class, function (EmailVerificationNotification $notification) use (&$token): bool {
            $token = $notification->token;

            return true;
        });
        $this->assertNotNull($token);

        $verified = $this->postJson('/api/v1/auth/email/verification/verify', ['token' => $token])
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);
        $this->assertNotNull($verified->json('data.email_verified_at'));
    }

    public function test_password_reset_requests_are_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => 'limited@example.test'])
                ->assertOk();
        }

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'limited@example.test'])
            ->assertTooManyRequests()
            ->assertJsonPath('error.code', 'RATE_LIMITED');
    }

    private function createUser(string $email, array $overrides = []): User
    {
        return app(UserRepository::class)->create(array_merge([
            'name' => 'Test Customer',
            'email' => $email,
            'phone' => null,
            'status' => 'active',
            'capabilities' => ['customer'],
            'memberships' => [],
            'driver_state' => null,
            'email_verified_at' => null,
            'password' => Hash::make('Password123'),
        ], $overrides));
    }
}
