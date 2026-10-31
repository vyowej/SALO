<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\PsgcLocation;
use App\Models\Restaurant;
use App\Models\RiderProfile;
use App\Models\UserAddress;
use Illuminate\Database\Eloquent\Relations\HasMany;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class AuthoritativeModelContractTest extends TestCase
{
    public function test_models_use_the_authoritative_schema_columns_and_relationship_shapes(): void
    {
        $addressFields = (new UserAddress())->getFillable();
        $this->assertContains('country_code', $addressFields);
        $this->assertContains('formatted_address', $addressFields);
        $this->assertTrue(method_exists(UserAddress::class, 'trashed'));

        $restaurantFields = (new Restaurant())->getFillable();
        foreach (['country_code', 'house_no', 'formatted_address'] as $field) {
            $this->assertContains($field, $restaurantFields);
        }
        $this->assertNotContains('category', $restaurantFields);
        $this->assertContains('country_code', (new RiderProfile())->getFillable());
        $this->assertSame('decimal:6', (new Restaurant())->getCasts()['latitude']);
        $this->assertSame('decimal:6', (new Restaurant())->getCasts()['longitude']);

        $orderFields = (new Order())->getFillable();
        foreach ([
            'checkout_id',
            'delivery_address_id',
            'delivery_country_code',
            'cancelled_by_type',
            'cancelled_by_user_id',
        ] as $field) {
            $this->assertContains($field, $orderFields);
        }
        $this->assertNotContains('checkout_group_id', $orderFields);
        $this->assertContains('changed_by', (new OrderStatusHistory())->getFillable());
        $orderCasts = (new Order())->getCasts();
        $this->assertSame('decimal:6', $orderCasts['delivery_lat']);
        $this->assertSame('decimal:6', $orderCasts['delivery_lng']);

        $psgc = new PsgcLocation();
        $this->assertSame('code', $psgc->getKeyName());
        $this->assertSame('string', $psgc->getKeyType());
        $this->assertFalse($psgc->getIncrementing());
        $this->assertFalse($psgc->timestamps);

        $payments = new ReflectionMethod(Order::class, 'payments');
        $this->assertSame(HasMany::class, $payments->getReturnType()->getName());
    }
}
