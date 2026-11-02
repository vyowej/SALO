<?php

namespace Tests\Feature;

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\CheckoutGroup;
use App\Models\Discount;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthoritativeFixtures;
use Tests\TestCase;

class CustomerCartCheckoutTest extends TestCase
{
    use AuthoritativeFixtures;

    protected function setUp(): void
    {
        parent::setUp();
    }

    public function test_cart_items_are_persisted_and_expiration_is_refreshed(): void
    {
        $customer = $this->createCustomer();
        [$restaurant, $item] = $this->createRestaurantAndItem();

        $response = $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/carts/{$restaurant->getKey()}/items", [
                'item_id' => $item->getKey(),
                'quantity' => 2,
                'note' => 'No onions',
            ])
            ->assertCreated()
            ->assertJsonPath('data.restaurant_id', $restaurant->getKey())
            ->assertJsonPath('data.items.0.quantity', 2)
            ->assertJsonPath('data.items.0.unit_price', 125);

        $cartItemId = $response->json('data.items.0.id');
        $this->assertDatabaseHas('cart_items', [
            'item_id' => $item->getKey(),
            'quantity' => 2,
            'note' => 'No onions',
        ]);
        $this->assertNotNull(DB::table('carts')->value('expires_at'));

        $this->patchJson("/api/v1/customer/carts/{$restaurant->getKey()}/items/{$cartItemId}", [
            'quantity' => 3,
            'note' => 'Extra rice',
        ])->assertOk()
            ->assertJsonPath('data.items.0.quantity', 3)
            ->assertJsonPath('data.items.0.note', 'Extra rice');

        $this->deleteJson("/api/v1/customer/carts/{$restaurant->getKey()}/items/{$cartItemId}")
            ->assertOk()
            ->assertJsonPath('data.items', []);
        $this->assertDatabaseHas('carts', [
            'user_id' => $customer->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'expires_at' => null,
        ]);
    }

    public function test_quote_uses_current_server_prices_and_computes_fees(): void
    {
        $customer = $this->createCustomer();
        [$restaurant, $item] = $this->createRestaurantAndItem();
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/carts/{$restaurant->getKey()}/items", [
                'item_id' => $item->getKey(),
                'quantity' => 2,
            ])->assertCreated();

        $this->postJson('/api/v1/customer/checkout/quote', [
            'orders' => [[
                'restaurant_id' => $restaurant->getKey(),
                'order_type' => 'pickup',
                'payment_method' => 'pay_at_pickup',
            ]],
        ])->assertOk()
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.orders.0.subtotal', 250)
            ->assertJsonPath('data.orders.0.service_fee', 12.5)
            ->assertJsonPath('data.orders.0.total', 262.5)
            ->assertJsonPath('data.orders.0.distance_source', null);
    }

    public function test_checkout_places_atomically_and_replays_the_same_idempotency_key(): void
    {
        $customer = $this->createCustomer(true);
        [$restaurant, $item] = $this->createRestaurantAndItem();
        $item->forceFill([
            'daily_quantity' => 4,
            'quantity_left' => 4,
        ])->save();
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/carts/{$restaurant->getKey()}/items", [
                'item_id' => $item->getKey(),
                'quantity' => 2,
            ])->assertCreated();

        $payload = ['orders' => [[
            'restaurant_id' => $restaurant->getKey(),
            'order_type' => 'pickup',
            'payment_method' => 'pay_at_pickup',
            'recipient_name' => 'Customer Test',
            'recipient_phone' => '09171234567',
        ]]];

        $first = $this->withHeader('Idempotency-Key', 'customer-test-checkout-1')
            ->postJson('/api/v1/customer/checkout', $payload)
            ->assertCreated()
            ->assertJsonPath('data.orders.0.status', 'placed')
            ->assertJsonPath('data.orders.0.total_amount', 262.5);

        $reference = $first->json('data.reference_code');
        $this->assertDatabaseHas('menu_items', ['id' => $item->getKey(), 'quantity_left' => 2]);
        $this->assertDatabaseMissing('cart_items', ['item_id' => $item->getKey()]);
        $this->assertDatabaseHas('payments', [
            'method' => 'pay_at_pickup',
            'status' => 'unpaid',
        ]);
        $this->assertDatabaseHas('order_status_histories', [
            'to_status' => 'placed',
            'changed_by' => $customer->getKey(),
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $customer->getKey(),
            'type' => 'order_status',
            'related_reference' => $first->json('data.orders.0.reference_code'),
        ]);

        $this->withHeader('Idempotency-Key', 'customer-test-checkout-1')
            ->postJson('/api/v1/customer/checkout', $payload)
            ->assertCreated()
            ->assertJsonPath('data.reference_code', $reference);
        $this->assertSame(1, DB::table('checkout_groups')->count());
        $this->assertSame(1, DB::table('orders')->count());
    }

    public function test_checkout_rejects_an_unavailable_item_without_creating_orders(): void
    {
        $customer = $this->createCustomer(true);
        [$restaurant, $item] = $this->createRestaurantAndItem();
        $item->forceFill([
            'daily_quantity' => 1,
            'quantity_left' => 1,
        ])->save();
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/carts/{$restaurant->getKey()}/items", [
                'item_id' => $item->getKey(),
                'quantity' => 1,
            ])->assertCreated();
        $item->forceFill(['quantity_left' => 0])->save();

        $this->withHeader('Idempotency-Key', 'customer-test-checkout-failure')
            ->postJson('/api/v1/customer/checkout', ['orders' => [[
                'restaurant_id' => $restaurant->getKey(),
                'order_type' => 'pickup',
                'payment_method' => 'pay_at_pickup',
                'recipient_name' => 'Customer Test',
                'recipient_phone' => '09171234567',
            ]]])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'CART_VALIDATION_FAILED');

        $this->assertSame(0, DB::table('checkout_groups')->count());
        $this->assertSame(0, DB::table('orders')->count());
        $this->assertDatabaseHas('cart_items', ['item_id' => $item->getKey(), 'quantity' => 1]);
    }

    public function test_customer_order_history_is_owned_and_cancel_restores_stock(): void
    {
        $customer = $this->createCustomer();
        [$restaurant, $item] = $this->createRestaurantAndItem();
        $item->forceFill(['daily_quantity' => 5, 'quantity_left' => 1])->save();
        $order = $this->createCustomerOrder($customer, $restaurant, $item, 'placed', 2);
        $otherCustomer = $this->createCustomer();
        $otherOrder = $this->createCustomerOrder($otherCustomer, $restaurant, $item, 'placed', 1);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/customer/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', (string) $order->getKey())
            ->assertJsonPath('data.0.items.0.quantity', 2);

        $this->getJson("/api/v1/customer/orders/{$otherOrder->getKey()}")
            ->assertNotFound();

        $this->getJson("/api/v1/customer/orders/{$order->getKey()}/tracking")
            ->assertOk()
            ->assertJsonPath('data.status', 'placed')
            ->assertJsonPath('data.live_location', null);

        $this->postJson("/api/v1/customer/orders/{$order->getKey()}/cancel", [
            'reason' => 'Placed by mistake',
        ])->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.cancel_reason', 'Placed by mistake');

        $this->assertDatabaseHas('menu_items', ['id' => $item->getKey(), 'quantity_left' => 3]);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->getKey(),
            'to_status' => 'cancelled',
            'changed_by' => $customer->getKey(),
        ]);
        $this->postJson("/api/v1/customer/orders/{$order->getKey()}/cancel")
            ->assertUnprocessable();
    }

    public function test_customer_receipt_confirmation_and_restaurant_review_are_single_use(): void
    {
        $customer = $this->createCustomer();
        [$restaurant, $item] = $this->createRestaurantAndItem();
        $order = $this->createCustomerOrder($customer, $restaurant, $item, 'delivered');

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/orders/{$order->getKey()}/receipt-confirmation", [
                'received' => false,
            ])->assertUnprocessable();

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/orders/{$order->getKey()}/receipt-confirmation", [
                'received' => true,
            ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.confirmation_method', 'customer');

        $this->postJson("/api/v1/customer/orders/{$order->getKey()}/receipt-confirmation", [
            'received' => true,
        ])->assertUnprocessable();

        $this->postJson("/api/v1/customer/orders/{$order->getKey()}/reviews/restaurant", [
            'rating' => 5,
            'comment' => 'Great meal.',
        ])->assertOk()
            ->assertJsonPath('data.restaurant_review.rating', 5);

        $this->postJson("/api/v1/customer/orders/{$order->getKey()}/reviews/restaurant", [
            'rating' => 4,
        ])->assertUnprocessable();
    }

    public function test_customer_notifications_are_scoped_and_can_be_marked_read(): void
    {
        $customer = $this->createCustomer();
        $otherCustomer = $this->createCustomer();
        $notificationId = DB::table('notifications')->insertGetId([
            'user_id' => $customer->getKey(),
            'type' => 'order_update',
            'message' => 'Your order was confirmed.',
            'related_reference' => 'ORD-1',
            'created_at' => now(),
        ]);
        $otherNotificationId = DB::table('notifications')->insertGetId([
            'user_id' => $otherCustomer->getKey(),
            'type' => 'order_update',
            'message' => 'Another customer update.',
            'related_reference' => 'ORD-2',
            'created_at' => now(),
        ]);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/customer/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', (string) $notificationId);

        $readResponse = $this->patchJson("/api/v1/customer/notifications/{$notificationId}/read", [])
            ->assertOk()
            ->assertJsonPath('data.id', (string) $notificationId)
            ->assertJsonStructure(['data' => ['read_at']]);
        $this->assertNotNull($readResponse->json('data.read_at'));
        $this->patchJson("/api/v1/customer/notifications/{$otherNotificationId}/read", [])
            ->assertNotFound();
    }

    public function test_checkout_uses_a_current_database_discount_and_records_its_redemption(): void
    {
        $customer = $this->createCustomer(true);
        [$restaurant, $item] = $this->createRestaurantAndItem();
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/carts/{$restaurant->getKey()}/items", [
                'item_id' => $item->getKey(),
                'quantity' => 2,
            ])->assertCreated();
        $discount = Discount::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'created_by' => $customer->getKey(),
            'funded_by' => 'restaurant',
            'code' => 'TEST50',
            'name' => 'Test fixed discount',
            'type' => 'fixed',
            'value' => 50,
            'min_order_amount' => 200,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'is_active' => true,
        ]);
        $order = [
            'restaurant_id' => $restaurant->getKey(),
            'order_type' => 'pickup',
            'payment_method' => 'pay_at_pickup',
            'discount_code' => 'TEST50',
            'recipient_name' => 'Customer Test',
            'recipient_phone' => '09171234567',
        ];

        $this->postJson('/api/v1/customer/checkout/quote', ['orders' => [$order]])
            ->assertOk()
            ->assertJsonPath('data.orders.0.discount.amount', 50)
            ->assertJsonPath('data.orders.0.total', 212.5);

        $this->withHeader('Idempotency-Key', 'customer-test-discount-checkout')
            ->postJson('/api/v1/customer/checkout', ['orders' => [$order]])
            ->assertCreated()
            ->assertJsonPath('data.orders.0.discount_amount', 50);

        $this->assertDatabaseHas('discount_redemptions', [
            'discount_id' => $discount->getKey(),
            'user_id' => $customer->getKey(),
            'amount_applied' => 50,
            'status' => 'applied',
        ]);
    }

    public function test_first_order_discount_is_fixed_value_and_rejected_after_a_prior_order(): void
    {
        $customer = $this->createCustomer(true);
        [$restaurant, $item] = $this->createRestaurantAndItem();
        $discount = Discount::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'created_by' => $customer->getKey(),
            'funded_by' => 'restaurant',
            'code' => 'FIRST75',
            'name' => 'First order discount',
            'type' => 'first_order',
            'value' => 75,
            'min_order_amount' => 0,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'is_active' => true,
        ]);
        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/carts/{$restaurant->getKey()}/items", [
                'item_id' => $item->getKey(),
                'quantity' => 2,
            ])->assertCreated();
        $order = [
            'restaurant_id' => $restaurant->getKey(),
            'order_type' => 'pickup',
            'payment_method' => 'pay_at_pickup',
            'discount_code' => 'FIRST75',
            'recipient_name' => 'Customer Test',
            'recipient_phone' => '09171234567',
        ];

        $this->postJson('/api/v1/customer/checkout/quote', ['orders' => [$order]])
            ->assertOk()
            ->assertJsonPath('data.orders.0.discount.valid', true)
            ->assertJsonPath('data.orders.0.discount.amount', 75)
            ->assertJsonPath('data.orders.0.total', 187.5);

        $this->withHeader('Idempotency-Key', 'customer-test-first-order')
            ->postJson('/api/v1/customer/checkout', ['orders' => [$order]])
            ->assertCreated()
            ->assertJsonPath('data.orders.0.discount_amount', 75);

        $this->postJson("/api/v1/customer/carts/{$restaurant->getKey()}/items", [
            'item_id' => $item->getKey(),
            'quantity' => 1,
        ])->assertOk()
            ->assertJsonPath('data.items.0.quantity', 1);
        $this->postJson('/api/v1/customer/checkout/quote', ['orders' => [$order]])
            ->assertOk()
            ->assertJsonPath('data.orders.0.discount.valid', false)
            ->assertJsonPath('data.orders.0.discount.amount', 0);

        $this->assertDatabaseHas('discount_redemptions', [
            'discount_id' => $discount->getKey(),
            'user_id' => $customer->getKey(),
            'amount_applied' => 75,
            'status' => 'applied',
        ]);
    }

    private function createCustomerOrder(User $customer, Restaurant $restaurant, MenuItem $item, string $status, int $quantity = 1): Order
    {
        $checkoutGroup = CheckoutGroup::query()->create([
            'user_id' => $customer->getKey(),
            'reference_code' => strtoupper(substr(sha1(uniqid('', true)), 0, 12)),
            'idempotency_key' => 'test-'.uniqid(),
            'placed_at' => now(),
        ]);
        $order = Order::query()->create([
            'checkout_id' => $checkoutGroup->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'reference_code' => strtoupper(substr(sha1(uniqid('', true)), 0, 12)),
            'order_type' => 'pickup',
            'status' => $status,
            'recipient_name' => 'Customer Test',
            'recipient_phone' => '09171234567',
            'subtotal' => $item->price * $quantity,
            'delivery_fee' => 0,
            'service_fee' => 0,
            'discount_amount' => 0,
            'total_amount' => $item->price * $quantity,
            'placed_at' => now(),
        ]);
        $order->items()->create([
            'item_id' => $item->getKey(),
            'item_name_snapshot' => $item->name,
            'unit_price_snapshot' => $item->price,
            'quantity' => $quantity,
        ]);
        $order->statusHistory()->create([
            'changed_by' => $customer->getKey(),
            'from_status' => null,
            'to_status' => $status,
            'changed_at' => now(),
        ]);

        return $order->fresh();
    }

    private function createCustomer(bool $verified = false): User
    {
        return User::query()->create([
            'email' => 'customer-'.uniqid().'@example.test',
            'password_hash' => 'Password123',
            'first_name' => 'Customer',
            'last_name' => 'Test',
            'mobile' => '09171234567',
            'status' => 'active',
            'email_verified_at' => $verified ? now() : null,
        ]);
    }

    private function createRestaurantAndItem(): array
    {
        $owner = $this->createCustomer();
        $restaurant = $this->createAuthoritativeRestaurant($owner, [
            'name' => 'C3 Test Restaurant',
            'is_published' => true,
            'latitude' => 14.6,
            'longitude' => 121.0,
            'delivery_radius_km' => 10,
        ]);
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Meals',
            'status' => 'active',
            'sort_order' => 1,
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Test Meal',
            'price' => '125.00',
            'lifecycle_status' => 'published',
            'is_available' => true,
            'prep_minutes' => 15,
        ]);

        return [$restaurant, $item];
    }
}
