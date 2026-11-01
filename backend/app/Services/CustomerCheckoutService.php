<?php

namespace App\Services;

use App\Exceptions\CartValidationException;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CheckoutGroup;
use App\Models\Discount;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\User;
use App\Models\UserAddress;
use App\Repositories\Contracts\CustomerCartRepository;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class CustomerCheckoutService
{
    public function __construct(
        private readonly CustomerCartRepository $carts,
        private readonly CustomerCartService $cartService,
        private readonly CustomerNotificationService $notifications,
    ) {}

    public function quote(int $userId, array $orders): array
    {
        $settings = $this->cartService->checkoutSettings();
        $quoted = [];

        foreach ($orders as $index => $order) {
            try {
                $prepared = $this->prepareOrder($userId, $order, $index, $settings, false, false);
                $quoted[] = $this->presentQuote($prepared);
            } catch (CartValidationException $exception) {
                $quoted[] = [
                    'restaurant_id' => (int) ($order['restaurant_id'] ?? 0),
                    'valid' => false,
                    'errors' => $exception->fields,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        return [
            'orders' => $quoted,
            'grand_total' => round((float) collect($quoted)->sum(fn ($row) => $row['total'] ?? 0), 2),
            'valid' => collect($quoted)->every(fn ($row) => ($row['valid'] ?? false) === true),
        ];
    }

    public function validateDiscount(int $userId, array $data): array
    {
        $settings = $this->cartService->checkoutSettings();
        $order = [
            'restaurant_id' => $data['restaurant_id'],
            'order_type' => $data['order_type'],
            'address_id' => $data['address_id'] ?? null,
            'payment_method' => $data['payment_method'],
            'discount_code' => $data['code'],
        ];

        try {
            $prepared = $this->prepareOrder($userId, $order, 0, $settings, false, false);
            $discount = $prepared['discount'];

            return [
                'valid' => $discount['valid'],
                'discount_amount' => $discount['discount_amount'],
                'message' => $discount['message'],
                'scope' => $discount['scope'],
                'subtotal' => $prepared['subtotal'],
                'total' => $prepared['total'],
            ];
        } catch (CartValidationException $exception) {
            return [
                'valid' => false,
                'discount_amount' => 0,
                'message' => $exception->getMessage(),
                'scope' => null,
                'errors' => $exception->fields,
            ];
        }
    }

    public function place(int $userId, array $orders, string $idempotencyKey): CheckoutGroup
    {
        $user = User::query()->findOrFail($userId);
        if ($user->email_verified_at === null) {
            throw new CartValidationException(
                'Verify your email before placing an order.',
                ['email' => ['Verify your email before placing an order.']],
                'EMAIL_VERIFICATION_REQUIRED',
                403,
            );
        }

        $existing = $this->carts->checkoutGroupForKey($userId, $idempotencyKey);
        if ($existing !== null) {
            $this->assertReplayMatches($existing, $orders);

            return $existing;
        }

        try {
            return $this->carts->transaction(function () use ($user, $orders, $idempotencyKey): CheckoutGroup {
                $this->carts->lockCustomerForCheckout((int) $user->getKey());
                $existingGroup = $this->carts->checkoutGroupForKey((int) $user->getKey(), $idempotencyKey);
                if ($existingGroup !== null) {
                    $this->assertReplayMatches($existingGroup, $orders);

                    return $existingGroup;
                }

                $settings = $this->cartService->checkoutSettings();
                $prepared = [];
                foreach ($orders as $index => $order) {
                    $prepared[] = $this->prepareOrder(
                        (int) $user->getKey(),
                        $order,
                        $index,
                        $settings,
                        true,
                        true,
                    );
                }

                $this->assertSinglePlatformDiscount($prepared);
                $group = $this->carts->createCheckoutGroup([
                    'user_id' => $user->getKey(),
                    'reference_code' => $this->referenceCode(),
                    'idempotency_key' => $idempotencyKey,
                    'placed_at' => now(),
                ]);

                foreach ($prepared as $section) {
                    $order = $this->carts->createOrder($group, [
                        'restaurant_id' => $section['restaurant']->getKey(),
                        'delivery_address_id' => $section['address']?->getKey(),
                        'reference_code' => $this->referenceCode(),
                        'order_type' => $section['order_type'],
                        'scheduled_for' => $section['scheduled_for'],
                        'status' => 'placed',
                        'recipient_name' => $section['recipient_name'],
                        'recipient_phone' => $section['recipient_phone'],
                        'delivery_address_text' => $section['address']?->formatted_address,
                        'delivery_country_code' => $section['address'] ? 'PH' : null,
                        'delivery_lat' => $section['address']?->latitude,
                        'delivery_lng' => $section['address']?->longitude,
                        'subtotal' => $section['subtotal'],
                        'delivery_fee' => $section['delivery_fee'],
                        'service_fee' => $section['service_fee'],
                        'discount_amount' => $section['discount']['discount_amount'],
                        'total_amount' => $section['total'],
                        'placed_at' => now(),
                    ]);

                    foreach ($section['items'] as $line) {
                        $this->carts->createOrderItem($order, [
                            'item_id' => $line['item']->getKey(),
                            'item_name_snapshot' => $line['item']->name,
                            'unit_price_snapshot' => $line['unit_price'],
                            'quantity' => $line['quantity'],
                            'note' => $line['note'],
                        ]);
                        $this->carts->decrementStock($line['item'], $line['quantity']);
                    }

                    $this->carts->createPayment($order, [
                        'method' => $section['payment_method'],
                        'status' => 'unpaid',
                        'amount' => $section['total'],
                    ]);
                    $this->carts->createStatusHistory($order, (int) $user->getKey());
                    $this->notifications->orderStatusChanged($order, 'placed');

                    if ($section['discount']['discount_id'] !== null) {
                        $this->carts->createDiscountRedemption(
                            $section['discount']['discount_id'],
                            $order,
                            (int) $user->getKey(),
                            $section['discount']['discount_amount'],
                        );
                    }

                    $this->carts->clearCart($section['cart']);
                }

                return $group->load([
                    'orders.restaurant',
                    'orders.items',
                    'orders.payments',
                ]);
            });
        } catch (QueryException $exception) {
            $existing = $this->carts->checkoutGroupForKey($userId, $idempotencyKey);
            if ($existing === null) {
                throw $exception;
            }

            $this->assertReplayMatches($existing, $orders);

            return $existing;
        }
    }

    private function prepareOrder(
        int $userId,
        array $data,
        int $index,
        array $settings,
        bool $lock,
        bool $strictDiscount,
    ): array {
        $restaurantId = (int) ($data['restaurant_id'] ?? 0);
        $restaurant = $this->carts->publicRestaurant($restaurantId, $lock);
        if ($restaurant === null) {
            $this->invalid("orders.{$index}.restaurant_id", 'This restaurant is not accepting customer orders.');
        }
        if ((int) $restaurant->owner_user_id === $userId
            || $restaurant->staff()->where('user_id', $userId)->where('status', 'active')->exists()) {
            $this->invalid("orders.{$index}.restaurant_id", 'You cannot place an order with a restaurant where you work.');
        }

        $orderType = $data['order_type'] ?? '';
        $paymentMethod = $data['payment_method'] ?? '';
        if (($orderType === 'delivery' && $paymentMethod !== 'cod')
            || ($orderType === 'pickup' && $paymentMethod !== 'pay_at_pickup')) {
            $this->invalid("orders.{$index}.payment_method", 'Choose the available payment method for this fulfilment type.');
        }
        if (! in_array($paymentMethod, ['cod', 'pay_at_pickup'], true)) {
            $this->invalid("orders.{$index}.payment_method", 'Online payment is coming soon and cannot be selected.');
        }

        $cart = $this->carts->cartForCustomer($userId, $restaurantId, $lock);
        if ($cart === null || ($cart->expires_at !== null && $cart->expires_at->isPast())) {
            $this->invalid("orders.{$index}.items", 'This restaurant cart is empty or expired.');
        }
        $cart->load('items');
        if ($cart->items->isEmpty()) {
            $this->invalid("orders.{$index}.items", 'Add an item before checking out.');
        }

        $items = $this->prepareItems($cart->items, $restaurantId, $index, $lock);
        $subtotal = round((float) collect($items)->sum(fn ($line) => $line['unit_price'] * $line['quantity']), 2);
        $address = null;
        $deliveryFee = 0.0;
        $distanceKm = null;

        if ($orderType === 'delivery') {
            if (empty($data['address_id'])) {
                $this->invalid("orders.{$index}.address_id", 'Choose a saved delivery address.');
            }
            $address = $this->carts->addressForCustomer($userId, (int) $data['address_id'], $lock);
            if ($address === null) {
                $this->invalid("orders.{$index}.address_id", 'Choose one of your saved addresses.');
            }
            if ($address->country_code !== 'PH' || $address->latitude === null || $address->longitude === null) {
                $this->invalid("orders.{$index}.address_id", 'Set a delivery pin inside the Philippines before ordering.');
            }
            if ($restaurant->latitude === null || $restaurant->longitude === null) {
                $this->invalid("orders.{$index}.restaurant_id", 'This restaurant has no delivery location configured.');
            }

            $distanceKm = $this->haversineKm(
                (float) $restaurant->latitude,
                (float) $restaurant->longitude,
                (float) $address->latitude,
                (float) $address->longitude,
            ) * (float) $settings['detour_factor'];
            $maxDistance = min((float) $restaurant->delivery_radius_km, (float) $settings['max_delivery_radius_km']);
            if ($distanceKm > $maxDistance) {
                $this->invalid("orders.{$index}.address_id", 'This address is outside the restaurant delivery radius.');
            }
            $extraKm = max(0, $distanceKm - (float) $settings['delivery_free_km']);
            $deliveryFee = round((float) $settings['delivery_base_fee']
                + ceil($extraKm) * (float) $settings['delivery_fee_per_km'], 2);
        }

        $scheduledFor = isset($data['scheduled_for']) && $data['scheduled_for'] !== ''
            ? Carbon::parse($data['scheduled_for'], 'Asia/Manila')
            : null;
        if ($scheduledFor !== null && $scheduledFor->lt(now()->addHour())) {
            $this->invalid("orders.{$index}.scheduled_for", 'Choose a time at least one hour from now.');
        }
        $this->ensureRestaurantOpen($restaurant, $scheduledFor ?? now(), $index);

        $recipientName = trim((string) ($data['recipient_name'] ?? ''));
        if ($recipientName === '') {
            $recipientName = $this->customerName(User::query()->findOrFail($userId));
        }
        $recipientPhone = trim((string) ($data['recipient_phone'] ?? ''));
        if ($recipientPhone === '') {
            $recipientPhone = (string) User::query()->findOrFail($userId)->mobile;
        }
        if ($recipientName === '' || $recipientPhone === '') {
            $this->invalid("orders.{$index}.recipient_name", 'Add the recipient name and phone number before placing this order.');
        }

        $serviceFee = round($subtotal * (float) $settings['service_fee_percent'] / 100, 2);
        $discount = $this->discountQuote(
            $userId,
            (int) $restaurant->getKey(),
            (string) ($data['discount_code'] ?? ''),
            $subtotal,
            $deliveryFee,
            $orderType === 'delivery',
            $lock,
        );
        if ($strictDiscount && ! $discount['valid']) {
            $this->invalid("orders.{$index}.discount_code", $discount['message'] ?? 'This code is not valid for this order.');
        }
        $total = round(max(0, $subtotal + $deliveryFee + $serviceFee - $discount['discount_amount']), 2);
        $prepMinutes = max(
            (int) $settings['default_prep_minutes'],
            (int) collect($items)->max(fn ($line) => (int) ($line['item']->prep_minutes ?? 0)),
        );
        $travelMinutes = $distanceKm === null
            ? 0
            : (int) ceil(($distanceKm / (float) $settings['avg_speed_kmh']) * 60);
        $etaMin = $distanceKm === null
            ? $prepMinutes
            : $prepMinutes + $travelMinutes * 2 + (int) $settings['handoff_buffer_minutes'];

        return [
            'restaurant' => $restaurant,
            'cart' => $cart,
            'items' => $items,
            'address' => $address,
            'order_type' => $orderType,
            'payment_method' => $paymentMethod,
            'recipient_name' => $recipientName,
            'recipient_phone' => $recipientPhone,
            'scheduled_for' => $scheduledFor,
            'subtotal' => $subtotal,
            'delivery_fee' => $deliveryFee,
            'service_fee' => $serviceFee,
            'discount' => $discount,
            'total' => $total,
            'distance_km' => $distanceKm,
            'distance_source' => $distanceKm === null ? null : 'straight_line_estimate',
            'eta_min_minutes' => $etaMin,
            'eta_max_minutes' => $etaMin + ($distanceKm === null ? 0 : 10),
            'eta_min_at' => now()->addMinutes($etaMin)->toISOString(),
            'eta_max_at' => now()->addMinutes($etaMin + ($distanceKm === null ? 0 : 10))->toISOString(),
        ];
    }

    private function prepareItems(Collection $cartItems, int $restaurantId, int $index, bool $lock): array
    {
        $itemIds = $cartItems->pluck('item_id')->map(fn ($id) => (int) $id)->sort()->values();
        $prepared = [];
        foreach ($itemIds as $itemId) {
            /** @var CartItem $cartItem */
            $cartItem = $cartItems->firstWhere('item_id', $itemId);
            $item = $this->carts->publicMenuItem($restaurantId, $itemId, $lock);
            if ($item === null) {
                $this->invalid("orders.{$index}.items.{$itemId}", 'A menu item is no longer available. Remove it from your cart to continue.');
            }
            if ((int) $cartItem->quantity < 1 || (int) $cartItem->quantity > 99) {
                $this->invalid("orders.{$index}.items.{$itemId}", 'The item quantity is outside the allowed range.');
            }
            $this->cartService->ensureCartStock($item, (int) $cartItem->quantity);
            $prepared[] = [
                'item' => $item,
                'quantity' => (int) $cartItem->quantity,
                'note' => $cartItem->note,
                'unit_price' => (float) $item->price,
            ];
        }

        return $prepared;
    }

    private function discountQuote(
        int $userId,
        int $restaurantId,
        string $code,
        float $subtotal,
        float $deliveryFee,
        bool $isDelivery,
        bool $lock,
    ): array {
        if (trim($code) === '') {
            return [
                'valid' => true,
                'message' => null,
                'discount_amount' => 0.0,
                'discount_id' => null,
                'scope' => null,
            ];
        }

        $discount = $this->carts->discountForCode($code, $restaurantId, $lock);
        $invalid = fn (string $message): array => [
            'valid' => false,
            'message' => $message,
            'discount_amount' => 0.0,
            'discount_id' => null,
            'scope' => null,
        ];
        if ($discount === null
            || ($discount->restaurant_id !== null && (int) $discount->restaurant_id !== $restaurantId)
            || ($discount->restaurant_id === null && $discount->funded_by !== 'platform')
            || ($discount->restaurant_id !== null && $discount->funded_by !== 'restaurant')) {
            return $invalid("This code isn't valid for this order.");
        }
        if (! $discount->is_active) {
            return $invalid('This code is not available right now.');
        }
        if ($discount->starts_at->isFuture()) {
            return $invalid('This code has not started yet.');
        }
        if ($discount->ends_at->isPast()) {
            return $invalid('This code is expired.');
        }
        if ($discount->usage_limit !== null
            && $this->carts->discountUsageCount((int) $discount->getKey(), $lock) >= (int) $discount->usage_limit) {
            return $invalid('This code has been fully claimed.');
        }
        if ($discount->per_customer_limit !== null
            && $this->carts->discountCustomerUsageCount((int) $discount->getKey(), $userId, $lock) >= (int) $discount->per_customer_limit) {
            return $invalid("You've already used this code.");
        }
        if ($subtotal < (float) $discount->min_order_amount) {
            return $invalid('Add ₱'.number_format((float) $discount->min_order_amount - $subtotal, 2).' more to use this code.');
        }

        $amount = match ($discount->type) {
            'percentage' => $subtotal * (float) $discount->value / 100,
            'fixed' => min($subtotal, (float) $discount->value),
            'free_delivery' => $isDelivery ? $deliveryFee : 0,
            'first_order' => $this->carts->hasPriorNonCancelledOrder($userId, $lock)
                ? 0
                : min($subtotal, (float) $discount->value),
            default => 0,
        };
        if (($discount->type === 'free_delivery' && ! $isDelivery)
            || ($discount->type === 'first_order' && $amount <= 0)) {
            return $invalid("This code isn't valid for this order.");
        }
        if ($discount->type === 'percentage' && $discount->max_discount !== null) {
            $amount = min($amount, (float) $discount->max_discount);
        }
        if (! in_array($discount->type, ['percentage', 'fixed', 'free_delivery', 'first_order'], true)) {
            return $invalid("This code isn't valid for this order.");
        }

        return [
            'valid' => true,
            'message' => null,
            'discount_amount' => round(min($subtotal + $deliveryFee, max(0, $amount)), 2),
            'discount_id' => (int) $discount->getKey(),
            'scope' => $discount->restaurant_id === null ? 'platform' : 'restaurant',
            'code' => $discount->code,
        ];
    }

    private function presentQuote(array $order): array
    {
        $discount = $order['discount'];

        return [
            'restaurant_id' => (int) $order['restaurant']->getKey(),
            'restaurant_name' => $order['restaurant']->name,
            'order_type' => $order['order_type'],
            'valid' => $discount['valid'],
            'errors' => $discount['valid'] ? [] : ['discount_code' => [$discount['message']]],
            'items' => collect($order['items'])->map(fn ($line): array => [
                'item_id' => (int) $line['item']->getKey(),
                'name' => $line['item']->name,
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'line_total' => round($line['quantity'] * $line['unit_price'], 2),
                'note' => $line['note'],
            ])->values(),
            'subtotal' => $order['subtotal'],
            'delivery_fee' => $order['delivery_fee'],
            'service_fee' => $order['service_fee'],
            'discount' => [
                'code' => $discount['code'] ?? null,
                'valid' => $discount['valid'],
                'amount' => $discount['discount_amount'],
                'message' => $discount['message'],
                'scope' => $discount['scope'],
            ],
            'total' => $order['total'],
            'distance_km' => $order['distance_km'],
            'distance_source' => $order['distance_source'],
            'eta' => [
                'min_minutes' => $order['eta_min_minutes'],
                'max_minutes' => $order['eta_max_minutes'],
                'min_at' => $order['eta_min_at'],
                'max_at' => $order['eta_max_at'],
            ],
        ];
    }

    private function ensureRestaurantOpen(Restaurant $restaurant, Carbon $at, int $index): void
    {
        $at = $at->copy()->timezone('Asia/Manila');
        if ($restaurant->is_24_7) {
            return;
        }

        if ($restaurant->closureDates->contains(
            fn ($closure) => Carbon::parse($closure->closure_date)->toDateString() === $at->toDateString(),
        )) {
            $this->invalid("orders.{$index}.scheduled_for", 'The restaurant is closed on the selected date.');
        }

        $weekday = $at->dayOfWeekIso;
        $time = $at->format('H:i:s');
        $open = $restaurant->operatingHours->contains(function ($hours) use ($weekday, $time): bool {
            if ((int) $hours->weekday === $weekday) {
                if ($hours->crosses_midnight) {
                    return $time >= $hours->open_time;
                }

                return $time >= $hours->open_time && $time < $hours->close_time;
            }

            if ((int) $hours->weekday === ($weekday === 1 ? 7 : $weekday - 1) && $hours->crosses_midnight) {
                return $time < $hours->close_time;
            }

            return false;
        });

        if (! $open) {
            $this->invalid("orders.{$index}.scheduled_for", 'The restaurant is closed at the selected time.');
        }
    }

    private function assertSinglePlatformDiscount(array $orders): void
    {
        $platformDiscounts = collect($orders)
            ->filter(fn ($order) => $order['discount']['scope'] === 'platform')
            ->count();
        if ($platformDiscounts > 1) {
            $this->invalid('orders', 'A platform-wide discount can be applied to only one restaurant order.');
        }
    }

    private function assertReplayMatches(CheckoutGroup $group, array $orders): void
    {
        $normalized = collect($orders)->keyBy(fn ($order) => (int) $order['restaurant_id']);
        $existingOrders = $group->orders->keyBy(fn ($order) => (int) $order->restaurant_id);
        $matches = $normalized->count() === $existingOrders->count()
            && $normalized->every(function ($request, $restaurantId) use ($existingOrders): bool {
                $saved = $existingOrders->get($restaurantId);
                if ($saved === null) {
                    return false;
                }
                $paymentMethod = $saved->payments->first()?->method;
                $discountCode = $saved->discountRedemptions->first()?->discount?->code;

                return $saved->order_type === $request['order_type']
                    && (int) ($saved->delivery_address_id ?? 0) === (int) ($request['address_id'] ?? 0)
                    && $saved->recipient_name === trim((string) ($request['recipient_name'] ?? $saved->recipient_name))
                    && $saved->recipient_phone === trim((string) ($request['recipient_phone'] ?? $saved->recipient_phone))
                    && $paymentMethod === $request['payment_method']
                    && ($saved->scheduled_for?->toISOString() ?? null) === (isset($request['scheduled_for'])
                        ? Carbon::parse($request['scheduled_for'])->toISOString()
                        : null)
                    && mb_strtoupper((string) $discountCode) === mb_strtoupper((string) ($request['discount_code'] ?? ''));
            });

        if (! $matches) {
            $this->invalid(
                'Idempotency-Key',
                'This checkout key was already used with different order details.',
                0,
                'IDEMPOTENCY_KEY_REUSED',
                409,
            );
        }
    }

    private function referenceCode(): string
    {
        return Str::upper(Str::random(12));
    }

    private function customerName(User $user): string
    {
        return trim(implode(' ', array_filter([
            $user->first_name,
            $user->middle_name,
            $user->last_name,
            $user->suffix,
        ])));
    }

    private function haversineKm(float $latitudeA, float $longitudeA, float $latitudeB, float $longitudeB): float
    {
        $radians = static fn (float $degrees): float => deg2rad($degrees);
        $latitudeDelta = $radians($latitudeB - $latitudeA);
        $longitudeDelta = $radians($longitudeB - $longitudeA);
        $a = sin($latitudeDelta / 2) ** 2
            + cos($radians($latitudeA)) * cos($radians($latitudeB))
            * sin($longitudeDelta / 2) ** 2;

        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function invalid(
        string $field,
        string $message,
        int $orderIndex = 0,
        string $errorCode = 'CART_VALIDATION_FAILED',
        int $status = 422,
    ): never {
        throw new CartValidationException(
            'Review the cart before placing your order.',
            [$field => [$message]],
            $errorCode,
            $status,
        );
    }
}
