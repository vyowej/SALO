<?php

namespace App\Repositories\Database;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CheckoutGroup;
use App\Models\Discount;
use App\Models\DiscountRedemption;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\User;
use App\Models\UserAddress;
use App\Repositories\Contracts\CustomerCartRepository;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DatabaseCustomerCartRepository implements CustomerCartRepository
{
    public function transaction(callable $callback): mixed
    {
        return DB::transaction($callback, 3);
    }

    public function lockCustomerForCheckout(int $userId): void
    {
        User::query()->whereKey($userId)->lockForUpdate()->firstOrFail();
    }

    public function activeCarts(int $userId): Collection
    {
        return Cart::query()
            ->where('user_id', $userId)
            ->where(function ($query): void {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->whereHas('items')
            ->with([
                'restaurant',
                'items.menuItem.category',
            ])
            ->orderBy('restaurant_id')
            ->get();
    }

    public function expireInactiveCarts(): int
    {
        return DB::transaction(function (): int {
            $expired = Cart::query()
                ->whereNotNull('expires_at')
                ->where('expires_at', '<=', now())
                ->with('items')
                ->lockForUpdate()
                ->get();

            foreach ($expired as $cart) {
                $cart->items()->delete();
                $cart->forceFill(['expires_at' => null])->save();
            }

            return $expired->count();
        }, 3);
    }

    public function publicRestaurant(int $restaurantId, bool $lock = false): ?Restaurant
    {
        $query = Restaurant::query()
            ->whereKey($restaurantId)
            ->where('status', 'approved')
            ->where('is_published', true)
            ->with(['operatingHours', 'closureDates']);

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function publicMenuItem(int $restaurantId, int $itemId, bool $lock = false): ?MenuItem
    {
        $query = MenuItem::query()
            ->whereKey($itemId)
            ->where('lifecycle_status', 'published')
            ->where('is_available', true)
            ->whereHas('category', fn ($category) => $category
                ->where('status', 'active')
                ->whereHas('restaurant', fn ($restaurant) => $restaurant
                    ->whereKey($restaurantId)
                    ->where('status', 'approved')
                    ->where('is_published', true)))
            ->with('category.restaurant');

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function cartForCustomer(int $userId, int $restaurantId, bool $lock = false): ?Cart
    {
        $query = Cart::query()
            ->where('user_id', $userId)
            ->where('restaurant_id', $restaurantId);

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function getOrCreateCart(int $userId, int $restaurantId): Cart
    {
        return Cart::query()->firstOrCreate([
            'user_id' => $userId,
            'restaurant_id' => $restaurantId,
        ]);
    }

    public function cartItemForCustomer(int $userId, int $restaurantId, int $cartItemId, bool $lock = false): ?CartItem
    {
        $query = CartItem::query()
            ->whereKey($cartItemId)
            ->whereHas('cart', fn ($cart) => $cart
                ->where('user_id', $userId)
                ->where('restaurant_id', $restaurantId));

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function addressForCustomer(int $userId, int $addressId, bool $lock = false): ?UserAddress
    {
        $query = UserAddress::query()
            ->where('user_id', $userId)
            ->whereKey($addressId);

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function discountForCode(string $code, int $restaurantId, bool $lock = false): ?Discount
    {
        $query = Discount::query()
            ->whereRaw('UPPER(code) = ?', [mb_strtoupper(trim($code))])
            ->where(function ($scope) use ($restaurantId): void {
                $scope->whereNull('restaurant_id')->orWhere('restaurant_id', $restaurantId);
            })
            ->orderByRaw('restaurant_id IS NULL');

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function discountUsageCount(int $discountId, bool $lock = false): int
    {
        $query = DiscountRedemption::query()
            ->where('discount_id', $discountId)
            ->where('status', 'applied');

        return $lock ? $query->lockForUpdate()->get()->count() : $query->count();
    }

    public function discountCustomerUsageCount(int $discountId, int $userId, bool $lock = false): int
    {
        $query = DiscountRedemption::query()
            ->where('discount_id', $discountId)
            ->where('user_id', $userId)
            ->where('status', 'applied');

        return $lock ? $query->lockForUpdate()->get()->count() : $query->count();
    }

    public function hasPriorNonCancelledOrder(int $userId, bool $lock = false): bool
    {
        $query = Order::query()
            ->whereHas('checkoutGroup', fn ($group) => $group->where('user_id', $userId))
            ->whereNotIn('status', ['cancelled', 'rejected']);

        return $lock
            ? $query->lockForUpdate()->first() !== null
            : $query->exists();
    }

    public function checkoutGroupForKey(int $userId, string $key): ?CheckoutGroup
    {
        return CheckoutGroup::query()
            ->where('user_id', $userId)
            ->where('idempotency_key', $key)
            ->with(['orders.items', 'orders.payments', 'orders.discountRedemptions.discount'])
            ->first();
    }

    public function createCheckoutGroup(array $attributes): CheckoutGroup
    {
        return CheckoutGroup::query()->create($attributes);
    }

    public function createOrder(CheckoutGroup $group, array $attributes): Order
    {
        return $group->orders()->create($attributes);
    }

    public function createOrderItem(Order $order, array $attributes): void
    {
        $order->items()->create($attributes);
    }

    public function createPayment(Order $order, array $attributes): void
    {
        $order->payments()->create($attributes);
    }

    public function createStatusHistory(Order $order, int $userId): void
    {
        $order->statusHistory()->create([
            'changed_by' => $userId,
            'from_status' => null,
            'to_status' => 'placed',
            'reason' => null,
            'changed_at' => now(),
        ]);
    }

    public function createDiscountRedemption(int $discountId, Order $order, int $userId, float $amount): void
    {
        DiscountRedemption::query()->create([
            'discount_id' => $discountId,
            'order_id' => $order->getKey(),
            'user_id' => $userId,
            'amount_applied' => $amount,
            'status' => 'applied',
        ]);
    }

    public function saveCartItem(Cart $cart, MenuItem $item, int $quantity, ?string $note): CartItem
    {
        $cartItem = CartItem::query()->firstOrNew([
            'cart_id' => $cart->getKey(),
            'item_id' => $item->getKey(),
        ]);
        $cartItem->forceFill([
            'quantity' => $quantity,
            'note' => $note,
        ])->save();

        return $cartItem->refresh();
    }

    public function deleteCartItem(CartItem $item): void
    {
        $item->delete();
    }

    public function clearCart(Cart $cart): void
    {
        $cart->items()->delete();
        $cart->forceFill(['expires_at' => null])->save();
    }

    public function decrementStock(MenuItem $item, int $quantity): void
    {
        if ($item->daily_quantity === null) {
            return;
        }

        $item->forceFill([
            'quantity_left' => (int) $item->quantity_left - $quantity,
        ])->save();
    }

}
