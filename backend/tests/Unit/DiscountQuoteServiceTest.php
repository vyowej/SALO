<?php

namespace Tests\Unit;

use App\Models\Discount;
use App\Services\DiscountQuoteService;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\TestCase;

class DiscountQuoteServiceTest extends TestCase
{
    private Carbon $now;

    protected function setUp(): void
    {
        parent::setUp();
        $this->now = Carbon::parse('2026-10-30 12:00:00', 'Asia/Manila');
    }

    public function test_percentage_is_capped_and_total_never_goes_below_zero(): void
    {
        $result = $this->quote($this->discount([
            'type' => 'percentage',
            'value' => 50,
            'max_discount' => 30,
        ]), subtotal: 100, deliveryFee: 25);

        self::assertSame(['valid' => true, 'message' => null, 'discount_amount' => 30.0, 'total_amount' => 95.0], $result);
    }

    public function test_fixed_discount_is_limited_to_the_subtotal_and_free_delivery_uses_delivery_fee(): void
    {
        $fixed = $this->quote($this->discount(['type' => 'fixed', 'value' => 500]), subtotal: 40, deliveryFee: 10);
        $freeDelivery = $this->quote($this->discount(['type' => 'free_delivery', 'value' => 0]), subtotal: 40, deliveryFee: 10);

        self::assertSame(40.0, $fixed['discount_amount']);
        self::assertSame(10.0, $fixed['total_amount']);
        self::assertSame(10.0, $freeDelivery['discount_amount']);
        self::assertSame(40.0, $freeDelivery['total_amount']);

        $highDeliveryFee = $this->quote($this->discount(['type' => 'free_delivery']), subtotal: 5, deliveryFee: 20);
        self::assertSame(20.0, $highDeliveryFee['discount_amount']);
        self::assertSame(5.0, $highDeliveryFee['total_amount']);
    }

    public function test_first_order_eligibility_and_pickup_delivery_restriction_are_checked(): void
    {
        $firstOrder = $this->discount(['first_order_only' => true]);
        $priorOrder = $this->quote($firstOrder, priorOrder: true);
        $pickupFreeDelivery = $this->quote($this->discount(['type' => 'free_delivery']), isDelivery: false);

        self::assertSame("This code isn't valid for this order.", $priorOrder['message']);
        self::assertSame("This code isn't valid for this order.", $pickupFreeDelivery['message']);
    }

    public function test_scope_dates_usage_and_minimum_return_plan_messages(): void
    {
        $discount = $this->discount(['usage_limit' => 1, 'min_order_amount' => 100]);

        self::assertSame("This code isn't valid for this order.", $this->quote(null)['message']);
        self::assertSame("This code isn't valid for this order.", $this->quote($discount, restaurantId: 99)['message']);
        self::assertSame('This code has been fully claimed.', $this->quote($discount, totalUses: 1)['message']);
        self::assertSame("You've already used this code.", $this->quote($discount, customerUses: 1)['message']);
        self::assertSame('Add ₱50.00 more to use this code.', $this->quote($discount, subtotal: 50)['message']);
        self::assertSame('This code is not available right now.', $this->quote($this->discount(['is_active' => false]))['message']);
        self::assertSame('This code starts on 2026-10-31.', $this->quote($this->discount(['starts_at' => '2026-10-31 00:00:00']))['message']);
        self::assertSame('This code is expired', $this->quote($this->discount(['ends_at' => '2026-10-29 23:59:59']))['message']);
    }

    private function quote(
        ?Discount $discount,
        int $restaurantId = 7,
        string $code = 'SAVE',
        float $subtotal = 100,
        float $deliveryFee = 20,
        int $totalUses = 0,
        int $customerUses = 0,
        bool $priorOrder = false,
        bool $isDelivery = true,
    ): array {
        return (new DiscountQuoteService)->quote(
            $discount,
            $restaurantId,
            $code,
            $subtotal,
            $deliveryFee,
            $totalUses,
            $customerUses,
            $priorOrder,
            $isDelivery,
            $this->now,
        );
    }

    private function discount(array $overrides = []): Discount
    {
        $discount = new Discount;
        $discount->forceFill(array_merge([
            'restaurant_id' => 7,
            'funded_by' => 'restaurant',
            'code' => 'SAVE',
            'type' => 'percentage',
            'value' => 10,
            'min_order_amount' => 0,
            'max_discount' => null,
            'starts_at' => '2026-10-01 00:00:00',
            'ends_at' => '2026-11-30 23:59:59',
            'usage_limit' => null,
            'per_customer_limit' => 1,
            'first_order_only' => false,
            'is_active' => true,
        ], $overrides));

        return $discount;
    }
}
