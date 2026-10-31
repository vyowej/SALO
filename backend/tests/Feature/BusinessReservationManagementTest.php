<?php

namespace Tests\Feature;

use App\Models\BusinessNotification;
use App\Models\Reservation;
use App\Models\ReservationSetting;
use App\Models\Restaurant;
use App\Models\RestaurantStaff;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Services\ReservationAvailabilityService;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class BusinessReservationManagementTest extends \Tests\TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_owner_can_manage_tables_and_settings_with_audit_records(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $request = $this->businessRequest($owner, $restaurant);

        $tableResponse = $request->postJson($this->tablePath($restaurant), [
            'table_number' => 'Window 1',
            'capacity' => 4,
            'area' => 'Window',
        ])->assertOk()
            ->assertJsonPath('data.table_number', 'Window 1')
            ->assertJsonPath('data.status', 'active');
        $tableId = $tableResponse->json('data.id');

        $request->postJson($this->tablePath($restaurant), [
            'table_number' => 'Window 1',
            'capacity' => 2,
        ])->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['table_number']]]);

        $request->putJson($this->settingsPath($restaurant), $this->settingsData())
            ->assertOk()
            ->assertJsonPath('data.is_configured', true)
            ->assertJsonPath('data.confirm_mode', 'manual');

        $request->patchJson($this->tablePath($restaurant, '/'.$tableId), [
            'table_number' => 'Window 1',
            'capacity' => 5,
            'area' => 'Main dining room',
            'status' => 'maintenance',
        ])->assertOk()
            ->assertJsonPath('data.status', 'maintenance');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $owner->getKey(),
            'type' => 'reservation.table.maintenance',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'restaurant_table.created',
            'entity_id' => (string) $tableId,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'reservation.settings.updated',
        ]);
    }

    public function test_reservation_endpoints_are_restaurant_scoped_and_permission_checked(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        [$ownerB, $restaurantB] = $this->createOwnerAndRestaurant();
        $tableB = $this->createTable($restaurantB, 'B-1');
        $reservation = $this->createReservation($ownerB, $tableB);

        $this->businessRequest($owner, $restaurant)
            ->getJson($this->reservationPath($restaurant, '/'.$reservation->getKey()))
            ->assertNotFound();

        $staff = $this->createUser('staff-'.uniqid().'@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $staff->getKey(),
            'staff_role' => 'staff',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $this->businessRequest($staff, $restaurant)
            ->getJson($this->tablePath($restaurant))
            ->assertForbidden();

        $reservationManager = $this->createUser('reservation-manager-'.uniqid().'@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $reservationManager->getKey(),
            'staff_role' => 'reservation_manager',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $this->businessRequest($reservationManager, $restaurant)
            ->getJson($this->tablePath($restaurant))
            ->assertOk();
    }

    public function test_reservation_decline_requires_a_reason_and_writes_audit(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $table = $this->createTable($restaurant, '1');
        $reservation = $this->createReservation($owner, $table);

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->reservationPath($restaurant, '/'.$reservation->getKey().'/status'), [
                'status' => 'declined',
            ])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['reason']]]);

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->reservationPath($restaurant, '/'.$reservation->getKey().'/status'), [
                'status' => 'declined',
                'reason' => 'No table is available.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'declined')
            ->assertJsonPath('data.response_reason', 'No table is available.');

        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'reservation.status.changed',
            'entity_id' => (string) $reservation->getKey(),
        ]);
    }

    public function test_maintenance_update_reports_future_reservations_as_attention_items(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $table = $this->createTable($restaurant, '1');
        $this->createReservation($owner, $table, 'confirmed', now()->addDay());

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->tablePath($restaurant, '/'.$table->getKey()), [
                'table_number' => $table->table_number,
                'capacity' => $table->capacity,
                'status' => 'maintenance',
            ])
            ->assertOk()
            ->assertJsonPath('data.affected_reservations', 1);

        $this->businessRequest($owner, $restaurant)
            ->getJson($this->reservationPath($restaurant).'?needs_attention=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_availability_service_rejects_an_overlapping_booking(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $restaurant->forceFill(['is_published' => true])->save();
        $table = $this->createTable($restaurant, '1', 4);
        $this->createSettings($restaurant);
        $availability = $this->app->make(ReservationAvailabilityService::class);
        $startAt = Carbon::now('Asia/Manila')->addDays(2)->setTime(19, 0)->utc();
        $payload = [
            'start_at' => $startAt->toISOString(),
            'guest_count' => 4,
            'reserved_for_name' => 'Guest One',
            'contact_phone' => '09123456789',
        ];

        $first = $availability->createReservation($restaurant, $owner, $payload);
        $this->assertSame('pending', $first->status);
        $this->assertSame((int) $table->getKey(), (int) $first->table_id);

        try {
            $availability->createReservation($restaurant, $owner, $payload);
            $this->fail('An overlapping reservation should not be allocated.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('start_at', $exception->errors());
        }
    }

    public function test_expired_pending_holds_are_released_idempotently(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $table = $this->createTable($restaurant, '1');
        $reservation = $this->createReservation($owner, $table, 'pending', now()->addDay(), now()->subMinute());

        $this->artisan('salo:expire-pending-reservations')->assertExitCode(0);
        $this->assertSame('expired', $reservation->fresh()->status);
        $this->artisan('salo:expire-pending-reservations')->assertExitCode(0);
        $this->assertSame('expired', $reservation->fresh()->status);
    }

    public function test_no_show_is_blocked_until_the_configured_grace_period_passes(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $table = $this->createTable($restaurant, '1');
        $this->createSettings($restaurant, ['grace_minutes' => 30]);
        $reservation = $this->createReservation($owner, $table, 'confirmed', now()->subMinutes(10));

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->reservationPath($restaurant, '/'.$reservation->getKey().'/status'), [
                'status' => 'no_show',
            ])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['status']]]);

        Carbon::setTestNow(now()->addMinutes(21));
        try {
            $this->businessRequest($owner, $restaurant)
                ->patchJson($this->reservationPath($restaurant, '/'.$reservation->getKey().'/status'), [
                    'status' => 'no_show',
                ])
                ->assertOk()
                ->assertJsonPath('data.status', 'no_show');
        } finally {
            Carbon::setTestNow();
        }
    }

    private function createOwnerAndRestaurant(): array
    {
        $owner = $this->createUser('owner-'.uniqid().'@example.test');
        $restaurant = Restaurant::query()->create([
            'owner_user_id' => $owner->getKey(),
            'name' => 'Test Restaurant',
            'status' => 'approved',
            'is_24_7' => true,
        ]);

        return [$owner, $restaurant];
    }

    private function createTable(Restaurant $restaurant, string $tableNumber, int $capacity = 4): RestaurantTable
    {
        return RestaurantTable::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'table_number' => $tableNumber,
            'capacity' => $capacity,
            'status' => 'active',
        ]);
    }

    private function createSettings(Restaurant $restaurant, array $overrides = []): ReservationSetting
    {
        return ReservationSetting::query()->create(array_merge([
            'restaurant_id' => $restaurant->getKey(),
            'accepts_reservations' => true,
            'confirm_mode' => 'manual',
            'review_window_hours' => 2,
            'slot_minutes' => 30,
            'dining_minutes' => 90,
            'min_lead_hours' => 1,
            'max_months_ahead' => 3,
            'max_party_size' => 12,
            'grace_minutes' => 15,
            'cancel_cutoff_hours' => 2,
        ], $overrides));
    }

    private function createReservation(
        User $user,
        RestaurantTable $table,
        string $status = 'pending',
        ?Carbon $startAt = null,
        ?Carbon $expiresAt = null,
    ): Reservation {
        static $reference = 1;

        return Reservation::query()->create([
            'user_id' => $user->getKey(),
            'table_id' => $table->getKey(),
            'reference_code' => 'RSV-'.str_pad((string) $reference++, 8, '0', STR_PAD_LEFT),
            'start_at' => $startAt ?? now()->addDay(),
            'duration_minutes' => 90,
            'guest_count' => 2,
            'reserved_for_name' => 'Guest Name',
            'contact_phone' => '09123456789',
            'status' => $status,
            'expires_at' => $expiresAt,
        ]);
    }

    private function settingsData(): array
    {
        return [
            'accepts_reservations' => true,
            'confirm_mode' => 'manual',
            'review_window_hours' => 2,
            'slot_minutes' => 30,
            'dining_minutes' => 90,
            'min_lead_hours' => 1,
            'max_months_ahead' => 3,
            'max_party_size' => 12,
            'grace_minutes' => 15,
            'cancel_cutoff_hours' => 2,
        ];
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password_hash' => 'Password123',
            'first_name' => 'Reservation',
            'last_name' => 'Tester',
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

    private function tablePath(Restaurant $restaurant, string $suffix = ''): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/tables'.$suffix;
    }

    private function settingsPath(Restaurant $restaurant): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/business/reservation-settings';
    }

    private function reservationPath(Restaurant $restaurant, string $suffix = ''): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/reservations'.$suffix;
    }
}
