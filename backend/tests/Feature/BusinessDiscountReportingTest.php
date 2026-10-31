<?php

namespace Tests\Feature;

use App\Models\ClosureDate;
use App\Models\Discount;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\RestaurantStaff;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Support\Carbon;

class BusinessDiscountReportingTest extends \Tests\TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_owner_can_create_and_deactivate_a_restaurant_discount(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $request = $this->businessRequest($owner, $restaurant);

        $response = $request->postJson($this->discountPath($restaurant), $this->discountData())
            ->assertOk()
            ->assertJsonPath('data.type', 'percentage')
            ->assertJsonPath('data.first_order_only', false)
            ->assertJsonPath('data.funded_by', 'restaurant');
        $discountId = $response->json('data.id');

        $unsupported = $request->postJson($this->discountPath($restaurant), $this->discountData(['code' => 'FIRST', 'first_order_only' => true]))
            ->assertUnprocessable();
        $unsupported->assertJsonStructure(['error' => ['fields' => ['first_order_only']]]);
        $request->postJson($this->discountPath($restaurant), $this->discountData(['code' => 'save']))
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['code']]]);

        $request->deleteJson($this->discountPath($restaurant, '/'.$discountId))
            ->assertNoContent();
        $this->assertDatabaseHas('discounts', [
            'id' => $discountId,
            'restaurant_id' => $restaurant->getKey(),
            'is_active' => false,
        ]);
    }

    public function test_discount_management_hides_restaurants_without_membership(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        [, $otherRestaurant] = $this->createOwnerAndRestaurant();

        $this->businessRequest($owner, $otherRestaurant)
            ->getJson($this->discountPath($otherRestaurant))
            ->assertNotFound();
    }

    public function test_discount_management_requires_the_management_permission(): void
    {
        [, $restaurant] = $this->createOwnerAndRestaurant();
        $staff = $this->createUser('staff-'.uniqid().'@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $staff->getKey(),
            'staff_role' => 'staff',
            'status' => 'active',
        ]);

        $this->businessRequest($staff, $restaurant)
            ->getJson($this->discountPath($restaurant))
            ->assertForbidden();
    }

    public function test_reservation_manager_gets_reservation_reports_and_calendar_events(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-30 12:00:00', 'Asia/Manila'));
        try {
            [$owner, $restaurant] = $this->createOwnerAndRestaurant();
            $table = RestaurantTable::query()->create([
                'restaurant_id' => $restaurant->getKey(),
                'table_number' => 'A1',
                'capacity' => 4,
                'status' => 'active',
            ]);
            Reservation::query()->create([
                'user_id' => $owner->getKey(),
                'table_id' => $table->getKey(),
                'reference_code' => 'RSV-00000001',
                'start_at' => Carbon::parse('2026-10-30 19:00:00', 'Asia/Manila')->utc(),
                'duration_minutes' => 90,
                'guest_count' => 2,
                'reserved_for_name' => 'Guest',
                'contact_phone' => '09123456789',
                'status' => 'confirmed',
            ]);
            foreach ([['RSV-00000002', 'completed', '17:00:00'], ['RSV-00000003', 'no_show', '18:00:00']] as [$reference, $status, $startAt]) {
                Reservation::query()->create([
                    'user_id' => $owner->getKey(),
                    'table_id' => $table->getKey(),
                    'reference_code' => $reference,
                    'start_at' => Carbon::parse('2026-10-30 '.$startAt, 'Asia/Manila')->utc(),
                    'duration_minutes' => 90,
                    'guest_count' => 2,
                    'reserved_for_name' => 'Guest',
                    'contact_phone' => '09123456789',
                    'status' => $status,
                ]);
            }
            ClosureDate::query()->create([
                'restaurant_id' => $restaurant->getKey(),
                'closure_date' => '2026-10-31',
                'reason' => 'Private event',
            ]);
            self::assertCount(1, app(RestaurantPageRepository::class)->closures($restaurant, '2026-10-30', '2026-10-31'));
            $reservationManager = $this->createUser('reservation-manager-'.uniqid().'@example.test');
            RestaurantStaff::query()->create([
                'restaurant_id' => $restaurant->getKey(),
                'user_id' => $reservationManager->getKey(),
                'staff_role' => 'reservation_manager',
                'status' => 'active',
            ]);
            $request = $this->businessRequest($reservationManager, $restaurant);

            $reservationReport = $request->getJson($this->reportPath($restaurant, 'reservations').'?from=2026-10-30&to=2026-10-30');
            $reservationReport->assertOk()
                ->assertJsonPath('data.summary.reservations', 3);
            $request->getJson($this->reportPath($restaurant, 'no_show_rate').'?from=2026-10-30&to=2026-10-30')
                ->assertOk()
                ->assertJsonPath('data.summary.eligible_reservations', 2)
                ->assertJsonPath('data.summary.no_show_rate_percent', 50);
            $request->getJson($this->reportPath($restaurant, 'sales_summary').'?from=2026-10-30&to=2026-10-30')
                ->assertForbidden();

            $request->getJson($this->calendarPath($restaurant).'?start=2026-10-30T00:00:00%2B08:00&end=2026-11-01T00:00:00%2B08:00')
                ->assertOk()
                ->assertJsonFragment(['title' => 'RSV-00000001'])
                ->assertJsonFragment(['title' => 'Closed · Private event']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_staff_calendar_does_not_include_reservation_events(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-30 12:00:00', 'Asia/Manila'));
        try {
            [$owner, $restaurant] = $this->createOwnerAndRestaurant();
            $table = RestaurantTable::query()->create([
                'restaurant_id' => $restaurant->getKey(),
                'table_number' => 'A1',
                'capacity' => 4,
                'status' => 'active',
            ]);
            Reservation::query()->create([
                'user_id' => $owner->getKey(),
                'table_id' => $table->getKey(),
                'reference_code' => 'RSV-00000004',
                'start_at' => Carbon::parse('2026-10-30 19:00:00', 'Asia/Manila')->utc(),
                'duration_minutes' => 90,
                'guest_count' => 2,
                'reserved_for_name' => 'Guest',
                'contact_phone' => '09123456789',
                'status' => 'confirmed',
            ]);
            $staff = $this->createUser('staff-'.uniqid().'@example.test');
            RestaurantStaff::query()->create([
                'restaurant_id' => $restaurant->getKey(),
                'user_id' => $staff->getKey(),
                'staff_role' => 'staff',
                'status' => 'active',
            ]);

            $this->businessRequest($staff, $restaurant)
                ->getJson($this->calendarPath($restaurant).'?start=2026-10-30T00:00:00%2B08:00&end=2026-11-01T00:00:00%2B08:00')
                ->assertOk()
                ->assertJsonMissing(['title' => 'RSV-00000004']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_report_export_is_csv(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();

        $this->businessRequest($owner, $restaurant)
            ->get($this->reportPath($restaurant, 'popular_items/export').'?from=2026-10-30&to=2026-10-30')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertHeader('content-disposition');
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

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password_hash' => 'Password123',
            'first_name' => 'Business',
            'last_name' => 'Tester',
            'status' => 'active',
        ]);
    }

    private function businessRequest(User $user, Restaurant $restaurant): self
    {
        self::assertContains('business', $user->capabilities);

        $request = $this->actingAs($user, 'web')
            ->withSession([
                'salo.active_mode' => 'business',
                'salo.selected_restaurant_id' => (string) $restaurant->getKey(),
            ])
            ->withHeaders([
                'X-SALO-Mode' => 'business',
                'X-SALO-Restaurant' => (string) $restaurant->getKey(),
            ]);

        return $request;
    }

    private function discountData(array $overrides = []): array
    {
        return array_merge([
            'code' => 'SAVE',
            'name' => 'First order deal',
            'description' => 'Test discount',
            'type' => 'percentage',
            'first_order_only' => false,
            'value' => 10,
            'min_order_amount' => 100,
            'max_discount' => 50,
            'starts_at' => now()->subDay()->toISOString(),
            'ends_at' => now()->addMonth()->toISOString(),
            'usage_limit' => 10,
            'per_customer_limit' => 1,
            'is_active' => true,
        ], $overrides);
    }

    private function discountPath(Restaurant $restaurant, string $suffix = ''): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/discounts'.$suffix;
    }

    private function reportPath(Restaurant $restaurant, string $report): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/reports/'.$report;
    }

    private function calendarPath(Restaurant $restaurant): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/calendar';
    }
}
