<?php

namespace Tests\Feature;

use App\Models\CheckoutGroup;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Restaurant;
use App\Models\RestaurantStaff;
use App\Models\User;
use Illuminate\Support\Carbon;

class BusinessOrderManagementTest extends \Tests\TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_owner_can_read_order_snapshots_and_actor_history(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $order = $this->createOrder($owner, $restaurant);
        OrderStatusHistory::query()->create([
            'order_id' => $order->getKey(),
            'actor_user_id' => $owner->getKey(),
            'from_status' => 'placed',
            'to_status' => 'confirmed',
            'reason' => null,
            'changed_at' => now(),
        ]);

        $response = $this->businessRequest($owner, $restaurant)
            ->getJson($this->orderPath($restaurant, '/'.$order->getKey()))
            ->assertOk()
            ->assertJsonPath('data.reference_code', $order->reference_code)
            ->assertJsonPath('data.items.0.name', 'Snapshot meal')
            ->assertJsonPath('data.status_history.1.actor.name', $owner->name);

        $this->assertArrayNotHasKey('customer_id', $response->json('data'));
    }

    public function test_staff_can_progress_orders_but_cannot_reject_or_cancel_and_cannot_see_actors(): void
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
        $order = $this->createOrder($owner, $restaurant);

        $this->businessRequest($staff, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$order->getKey().'/status'), [
                'status' => 'confirmed',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonMissingPath('data.status_history.1.actor');

        $this->businessRequest($staff, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$order->getKey().'/status'), [
                'status' => 'rejected',
                'reason' => 'A sample reason.',
            ])
            ->assertForbidden();

        $this->businessRequest($staff, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$order->getKey().'/status'), [
                'status' => 'cancelled',
                'reason' => 'A sample reason.',
            ])
            ->assertForbidden();
    }

    public function test_manager_cancellation_requires_reason_and_restores_stock_once(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $manager = $this->createUser('manager-'.uniqid().'@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $manager->getKey(),
            'staff_role' => 'manager',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $order = $this->createOrder($owner, $restaurant, 'confirmed', 3);

        $this->businessRequest($manager, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$order->getKey().'/status'), [
                'status' => 'cancelled',
            ])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['reason']]]);

        $this->businessRequest($manager, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$order->getKey().'/status'), [
                'status' => 'cancelled',
                'reason' => 'Item unavailable.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertSame(5, $order->items()->firstOrFail()->menuItem->fresh()->quantity_left);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'order.status.changed',
            'entity_id' => (string) $order->getKey(),
        ]);
        $this->businessRequest($manager, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$order->getKey().'/status'), [
                'status' => 'cancelled',
                'reason' => 'Duplicate request.',
            ])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['status']]]);
        $this->assertSame(5, $order->items()->firstOrFail()->menuItem->fresh()->quantity_left);
    }

    public function test_orders_are_scoped_to_the_route_restaurant(): void
    {
        [$ownerA, $restaurantA] = $this->createOwnerAndRestaurant();
        [$ownerB, $restaurantB] = $this->createOwnerAndRestaurant();
        $order = $this->createOrder($ownerB, $restaurantB);

        $this->businessRequest($ownerA, $restaurantA)
            ->getJson($this->orderPath($restaurantA, '/'.$order->getKey()))
            ->assertNotFound();

        $this->businessRequest($ownerA, $restaurantA)
            ->patchJson($this->orderPath($restaurantA, '/'.$order->getKey().'/status'), [
                'status' => 'confirmed',
            ])
            ->assertNotFound();
    }

    public function test_suspended_restaurant_allows_order_reads_but_blocks_status_updates(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $order = $this->createOrder($owner, $restaurant);
        $restaurant->forceFill(['status' => 'suspended'])->save();

        $this->businessRequest($owner, $restaurant)
            ->getJson($this->orderPath($restaurant))
            ->assertOk();

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$order->getKey().'/status'), [
                'status' => 'confirmed',
            ])
            ->assertForbidden();

        $this->assertSame('placed', $order->fresh()->status);
    }

    public function test_invalid_transitions_and_delivery_completion_are_rejected(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $deliveryOrder = $this->createOrder($owner, $restaurant);
        $pickupOrder = $this->createOrder($owner, $restaurant, 'ready', 3, 'pick_up');

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$deliveryOrder->getKey().'/status'), [
                'status' => 'ready',
            ])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['status']]]);

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$pickupOrder->getKey().'/status'), [
                'status' => 'completed',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->businessRequest($owner, $restaurant)
            ->patchJson($this->orderPath($restaurant, '/'.$deliveryOrder->getKey().'/status'), [
                'status' => 'completed',
            ])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['status']]]);
    }

    public function test_unanswered_placed_orders_auto_cancel_after_ten_minutes_with_system_actor(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $order = $this->createOrder($owner, $restaurant, 'placed', 3);
        $order->forceFill(['placed_at' => now()->subMinutes(11)])->save();
        Carbon::setTestNow(now());
        try {
            $this->artisan('salo:cancel-unanswered-orders')->assertExitCode(0);
        } finally {
            Carbon::setTestNow();
        }

        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertSame(5, $order->items()->firstOrFail()->menuItem->fresh()->quantity_left);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->getKey(),
            'from_status' => 'placed',
            'to_status' => 'cancelled',
            'actor_user_id' => null,
        ]);
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

    private function createOrder(
        User $owner,
        Restaurant $restaurant,
        string $status = 'placed',
        int $quantityLeft = 3,
        string $orderType = 'delivery',
    ): Order {
        static $reference = 1;
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Orders '.uniqid(),
            'status' => 'active',
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Snapshot meal',
            'price' => '20.00',
            'lifecycle_status' => 'published',
            'is_available' => true,
            'daily_quantity' => 5,
            'quantity_left' => $quantityLeft,
        ]);
        $group = CheckoutGroup::query()->create([
            'user_id' => $owner->getKey(),
            'reference_code' => 'GROUP-'.uniqid(),
            'idempotency_key' => null,
            'placed_at' => now(),
        ]);
        $order = Order::query()->create([
            'checkout_group_id' => $group->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'reference_code' => 'ORDER-'.str_pad((string) $reference++, 8, '0', STR_PAD_LEFT),
            'order_type' => $orderType,
            'status' => $status,
            'recipient_name' => 'Test Recipient',
            'recipient_phone' => '09123456789',
            'delivery_address_text' => $orderType === 'delivery' ? 'Test address' : null,
            'delivery_lat' => $orderType === 'delivery' ? 14.6 : null,
            'delivery_lng' => $orderType === 'delivery' ? 121.0 : null,
            'subtotal' => '40.00',
            'delivery_fee' => $orderType === 'delivery' ? '35.00' : '0.00',
            'service_fee' => '2.00',
            'discount_amount' => '0.00',
            'total_amount' => $orderType === 'delivery' ? '77.00' : '42.00',
            'placed_at' => now(),
        ]);
        OrderItem::query()->create([
            'order_id' => $order->getKey(),
            'item_id' => $item->getKey(),
            'item_name_snapshot' => 'Snapshot meal',
            'unit_price_snapshot' => '20.00',
            'quantity' => 2,
        ]);
        OrderStatusHistory::query()->create([
            'order_id' => $order->getKey(),
            'actor_user_id' => null,
            'from_status' => null,
            'to_status' => $status,
            'reason' => null,
            'changed_at' => now(),
        ]);

        return $order;
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password_hash' => 'Password123',
            'first_name' => 'Order',
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

    private function orderPath(Restaurant $restaurant, string $suffix = ''): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/orders'.$suffix;
    }
}
