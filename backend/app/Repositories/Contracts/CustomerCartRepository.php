<?php

namespace App\Repositories\Contracts;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CheckoutGroup;
use App\Models\Discount;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\UserAddress;
use Illuminate\Support\Collection;

interface CustomerCartRepository
{
    public function transaction(callable $callback): mixed;

    public function lockCustomerForCheckout(int $userId): void;

    public function activeCarts(int $userId): Collection;

    public function publicRestaurant(int $restaurantId, bool $lock = false): ?Restaurant;

    public function publicMenuItem(int $restaurantId, int $itemId, bool $lock = false): ?MenuItem;

    public function cartForCustomer(int $userId, int $restaurantId, bool $lock = false): ?Cart;

    public function getOrCreateCart(int $userId, int $restaurantId): Cart;

    public function cartItemForCustomer(int $userId, int $restaurantId, int $cartItemId, bool $lock = false): ?CartItem;

    public function addressForCustomer(int $userId, int $addressId, bool $lock = false): ?UserAddress;

    public function discountForCode(string $code, int $restaurantId, bool $lock = false): ?Discount;

    public function discountUsageCount(int $discountId, bool $lock = false): int;

    public function discountCustomerUsageCount(int $discountId, int $userId, bool $lock = false): int;

    public function hasPriorNonCancelledOrder(int $userId, bool $lock = false): bool;

    public function checkoutGroupForKey(int $userId, string $key): ?CheckoutGroup;

    public function createCheckoutGroup(array $attributes): CheckoutGroup;

    public function createOrder(CheckoutGroup $group, array $attributes): Order;

    public function createOrderItem(Order $order, array $attributes): void;

    public function createPayment(Order $order, array $attributes): void;

    public function createStatusHistory(Order $order, int $userId): void;

    public function createDiscountRedemption(int $discountId, Order $order, int $userId, float $amount): void;

    public function saveCartItem(Cart $cart, MenuItem $item, int $quantity, ?string $note): CartItem;

    public function deleteCartItem(CartItem $item): void;

    public function clearCart(Cart $cart): void;

    public function decrementStock(MenuItem $item, int $quantity): void;

    public function expireInactiveCarts(): int;
}
