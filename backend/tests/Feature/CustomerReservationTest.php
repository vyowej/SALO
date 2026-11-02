<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\ReservationSetting;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Models\ClosureDate;
use App\Models\OperatingHour;
use Illuminate\Support\Carbon;
use Tests\Support\AuthoritativeFixtures;
use Tests\TestCase;

class CustomerReservationTest extends TestCase
{
    use AuthoritativeFixtures;

    public function test_verified_customer_can_check_slots_and_create_a_manual_reservation(): void
    {
        $customer = $this->createCustomer();
        [$restaurant] = $this->createRestaurant();
        $date = now('Asia/Manila')->addDays(2)->toDateString();

        $slots = $this->actingAs($customer, 'sanctum')
            ->getJson($this->slotsPath($restaurant, $date))
            ->assertOk()
            ->assertJsonStructure(['data' => [[
                'table_id',
                'table_number',
                'capacity',
                'area',
                'start_at',
                'end_at',
                'duration_minutes',
                'guest_count',
            ]]]);

        $slot = $slots->json('data.0');
        $this->postJson('/api/v1/customer/reservations', [
            'restaurant_id' => $restaurant->getKey(),
            'table_id' => $slot['table_id'],
            'start_at' => $slot['start_at'],
            'duration_minutes' => $slot['duration_minutes'],
            'guest_count' => 2,
            'reserved_for_name' => 'Reservation Guest',
            'contact_phone' => '09171234567',
            'special_request' => 'Window seat, if available',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.restaurant.name', $restaurant->name)
            ->assertJsonPath('data.guest_count', 2)
            ->assertJsonPath('data.special_request', 'Window seat, if available');

        $reference = Reservation::query()->value('reference_code');
        $this->assertSame(12, strlen($reference));
    }

    public function test_automatic_restaurant_mode_confirms_the_reservation(): void
    {
        $customer = $this->createCustomer();
        [$restaurant, $table] = $this->createRestaurant('automatic');
        $startAt = now('Asia/Manila')->addDays(2)->setTime(18, 0)->utc();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/reservations', $this->reservationPayload($restaurant, $table, $startAt))
            ->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.expires_at', null);
    }

    public function test_slot_lookup_respects_hours_closures_and_table_capacity(): void
    {
        $customer = $this->createCustomer();
        [$restaurant] = $this->createRestaurant();
        $restaurant->forceFill(['is_24_7' => false])->save();
        $settings = ReservationSetting::query()->findOrFail($restaurant->getKey());
        $settings->forceFill(['dining_minutes' => 60])->save();
        foreach (range(1, 7) as $weekday) {
            OperatingHour::query()->create([
                'restaurant_id' => $restaurant->getKey(),
                'weekday' => $weekday,
                'open_time' => '17:00',
                'close_time' => '19:00',
                'crosses_midnight' => false,
                'shift_order' => 1,
            ]);
        }
        $date = now('Asia/Manila')->addDays(2)->toDateString();
        $request = $this->actingAs($customer, 'sanctum');

        $slots = $request->getJson($this->slotsPath($restaurant, $date))
            ->assertOk()
            ->json('data');
        $this->assertSame(['17:00', '17:30', '18:00'], array_map(
            fn (array $slot): string => Carbon::parse($slot['start_at'])->timezone('Asia/Manila')->format('H:i'),
            $slots,
        ));
        $request->getJson('/api/v1/restaurants/'.$restaurant->getKey().'/reservation-slots?date='.$date.'&guest_count=5')
            ->assertOk()
            ->assertJsonPath('data', []);

        ClosureDate::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'closure_date' => $date,
            'reason' => 'Private event',
        ]);
        $request->getJson($this->slotsPath($restaurant, $date))
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_unverified_customer_and_customer_over_active_limit_cannot_book(): void
    {
        $unverified = $this->createCustomer(false);
        [$restaurant, $table] = $this->createRestaurant();
        $startAt = now('Asia/Manila')->addDays(2)->setTime(18, 0)->utc();

        $this->actingAs($unverified, 'sanctum')
            ->postJson('/api/v1/customer/reservations', $this->reservationPayload($restaurant, $table, $startAt))
            ->assertForbidden();

        $verified = $this->createCustomer();
        foreach (range(1, 3) as $index) {
            $this->createReservation($verified, $table, now()->addDays($index + 2));
        }

        $this->actingAs($verified, 'sanctum')
            ->postJson('/api/v1/customer/reservations', $this->reservationPayload(
                $restaurant,
                $table,
                now('Asia/Manila')->addDays(6)->setTime(18, 0)->utc(),
            ))
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['reservation']]]);
    }

    public function test_booking_rechecks_table_overlap_after_a_slot_was_returned(): void
    {
        $customer = $this->createCustomer();
        $existingCustomer = $this->createCustomer();
        [$restaurant, $table] = $this->createRestaurant();
        $date = now('Asia/Manila')->addDays(2)->toDateString();
        $slot = $this->actingAs($customer, 'sanctum')
            ->getJson($this->slotsPath($restaurant, $date))
            ->assertOk()
            ->json('data.0');

        $this->createReservation($existingCustomer, $table, Carbon::parse($slot['start_at']));

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/reservations', $this->reservationPayload(
                $restaurant,
                $table,
                Carbon::parse($slot['start_at']),
            ))
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['start_at']]]);
    }

    public function test_customer_can_only_view_and_cancel_owned_reservations_before_cutoff(): void
    {
        $customer = $this->createCustomer();
        $otherCustomer = $this->createCustomer();
        [$restaurant, $table] = $this->createRestaurant();
        $reservation = $this->createReservation($customer, $table, now()->addDays(2));

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/customer/reservations')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $reservation->getKey());

        $this->actingAs($otherCustomer, 'sanctum')
            ->getJson('/api/v1/customer/reservations/'.$reservation->getKey())
            ->assertNotFound();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/reservations/'.$reservation->getKey().'/cancel', [
                'reason' => 'Plans changed',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.cancel_reason', 'Plans changed');

        $insideCutoff = $this->createReservation($customer, $table, now()->addHour());
        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/reservations/'.$insideCutoff->getKey().'/cancel')
            ->assertUnprocessable();
    }

    public function test_customer_rescheduling_endpoint_is_not_enabled(): void
    {
        $customer = $this->createCustomer();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/reservations/123/reschedule')
            ->assertNotFound();
    }

    private function createRestaurant(string $confirmMode = 'manual'): array
    {
        $owner = $this->createCustomer();
        $restaurant = $this->createAuthoritativeRestaurant($owner, [
            'name' => 'Customer Reservation Test',
            'is_published' => true,
        ]);
        ReservationSetting::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'accepts_reservations' => true,
            'confirm_mode' => $confirmMode,
            'review_window_hours' => 24,
            'slot_minutes' => 30,
            'dining_minutes' => 90,
            'min_lead_hours' => 1,
            'max_months_ahead' => 3,
            'max_party_size' => 12,
            'grace_minutes' => 15,
            'cancel_cutoff_hours' => 2,
        ]);
        $table = RestaurantTable::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'table_number' => 'T-1',
            'capacity' => 4,
            'area' => 'Main',
            'status' => 'active',
        ]);

        return [$restaurant, $table];
    }

    private function createCustomer(bool $verified = true): User
    {
        static $sequence = 0;
        $sequence++;

        return User::query()->create([
            'email' => 'customer-reservation-'.$sequence.'-'.uniqid().'@example.test',
            'password_hash' => 'Password123',
            'first_name' => 'Reservation',
            'last_name' => 'Customer',
            'status' => 'active',
            'email_verified_at' => $verified ? now() : null,
        ]);
    }

    private function createReservation(User $customer, RestaurantTable $table, Carbon $startAt): Reservation
    {
        static $sequence = 0;
        $sequence++;

        return Reservation::query()->create([
            'user_id' => $customer->getKey(),
            'table_id' => $table->getKey(),
            'reference_code' => 'R'.str_pad((string) $sequence, 11, '0', STR_PAD_LEFT),
            'start_at' => $startAt,
            'duration_minutes' => 90,
            'guest_count' => 2,
            'reserved_for_name' => 'Reservation Guest',
            'contact_phone' => '09171234567',
            'status' => 'pending',
            'expires_at' => now()->addDay(),
        ]);
    }

    private function reservationPayload(Restaurant $restaurant, RestaurantTable $table, Carbon $startAt): array
    {
        return [
            'restaurant_id' => $restaurant->getKey(),
            'table_id' => $table->getKey(),
            'start_at' => $startAt->toISOString(),
            'duration_minutes' => 90,
            'guest_count' => 2,
            'reserved_for_name' => 'Reservation Guest',
            'contact_phone' => '09171234567',
        ];
    }

    private function slotsPath(Restaurant $restaurant, string $date): string
    {
        return '/api/v1/restaurants/'.$restaurant->getKey().'/reservation-slots?date='.$date.'&guest_count=2';
    }
}
