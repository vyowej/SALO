<?php

namespace App\Services;

use App\Exceptions\CartValidationException;
use App\Models\Cart;
use App\Models\MenuItem;
use App\Repositories\Contracts\CustomerCartRepository;
use App\Repositories\Contracts\PlatformSettingsRepository;
use Illuminate\Database\Eloquent\Collection;

class CustomerCartService
{
    public function __construct(
        private readonly CustomerCartRepository $carts,
        private readonly PlatformSettingsRepository $settings,
    ) {}

    public function list(int $userId): Collection
    {
        return $this->carts->activeCarts($userId);
    }

    public function addItem(int $userId, string $restaurantId, array $data): Cart
    {
        $restaurantId = $this->parseId($restaurantId, 'restaurant_id');
        $settings = $this->checkoutSettings();

        return $this->carts->transaction(function () use ($userId, $restaurantId, $data, $settings): Cart {
            $this->requireRestaurant($restaurantId, true);
            $item = $this->requireOrderableItem($restaurantId, (int) $data['item_id'], true);
            $cart = $this->carts->getOrCreateCart($userId, $restaurantId);
            $existing = $cart->items()->where('item_id', $item->getKey())->lockForUpdate()->first();
            $quantity = (int) $data['quantity'] + (int) ($existing?->quantity ?? 0);

            if ($quantity > 99) {
                $this->invalid('quantity', 'A menu item may not exceed 99 in one cart.');
            }

            $this->ensureCartStock($item, $quantity);
            $this->carts->saveCartItem(
                $cart,
                $item,
                $quantity,
                array_key_exists('note', $data) ? $data['note'] : $existing?->note,
            );
            $cart->forceFill(['expires_at' => now()->addDays((int) $settings['cart_expiry_days'])])->save();

            return $this->loadCart($cart);
        });
    }

    public function updateItem(int $userId, string $restaurantId, string $itemId, array $data): Cart
    {
        $restaurantId = $this->parseId($restaurantId, 'restaurant_id');
        $itemId = $this->parseId($itemId, 'item');
        $settings = $this->checkoutSettings();

        return $this->carts->transaction(function () use ($userId, $restaurantId, $itemId, $data, $settings): Cart {
            $cartItem = $this->carts->cartItemForCustomer($userId, $restaurantId, $itemId, true);
            if ($cartItem === null) {
                abort(404);
            }

            if (isset($data['quantity']) && (int) $data['quantity'] === 0) {
                $cart = $cartItem->cart;
                $this->carts->deleteCartItem($cartItem);
                $this->refreshExpiration($cart, (int) $settings['cart_expiry_days']);

                return $this->loadCart($cart);
            }

            if (isset($data['quantity'])) {
                $menuItem = $this->requireOrderableItem($restaurantId, (int) $cartItem->item_id, true);
                $this->ensureCartStock($menuItem, (int) $data['quantity']);
                $cartItem->quantity = (int) $data['quantity'];
            }
            if (array_key_exists('note', $data)) {
                $cartItem->note = $data['note'];
            }
            $cartItem->save();
            $cart = $cartItem->cart;
            $this->refreshExpiration($cart, (int) $settings['cart_expiry_days']);

            return $this->loadCart($cart);
        });
    }

    public function removeItem(int $userId, string $restaurantId, string $itemId): Cart
    {
        $restaurantId = $this->parseId($restaurantId, 'restaurant_id');
        $itemId = $this->parseId($itemId, 'item');
        $settings = $this->checkoutSettings();

        return $this->carts->transaction(function () use ($userId, $restaurantId, $itemId, $settings): Cart {
            $cartItem = $this->carts->cartItemForCustomer($userId, $restaurantId, $itemId, true);
            if ($cartItem === null) {
                abort(404);
            }

            $cart = $cartItem->cart;
            $this->carts->deleteCartItem($cartItem);
            $this->refreshExpiration($cart, (int) $settings['cart_expiry_days']);

            return $this->loadCart($cart);
        });
    }

    public function clear(int $userId, string $restaurantId): void
    {
        $restaurantId = $this->parseId($restaurantId, 'restaurant_id');
        $this->carts->transaction(function () use ($userId, $restaurantId): void {
            $cart = $this->carts->cartForCustomer($userId, $restaurantId, true);
            if ($cart !== null) {
                $this->carts->clearCart($cart);
            }
        });
    }

    public function expireInactive(): int
    {
        return $this->carts->expireInactiveCarts();
    }

    public function checkoutSettings(): array
    {
        $all = $this->settings->all();
        $keys = [
            'delivery_base_fee',
            'delivery_free_km',
            'delivery_fee_per_km',
            'service_fee_percent',
            'max_delivery_radius_km',
            'default_prep_minutes',
            'handoff_buffer_minutes',
            'avg_speed_kmh',
            'detour_factor',
            'cart_expiry_days',
        ];
        $values = [];
        foreach ($keys as $key) {
            if (! isset($all[$key]) || ! is_numeric($all[$key]) || (float) $all[$key] < 0) {
                throw new CartValidationException(
                    'Checkout pricing is not configured. Please try again later.',
                    ['settings' => ['Checkout pricing is not configured.']],
                    'CHECKOUT_CONFIGURATION_UNAVAILABLE',
                    503,
                );
            }
            $values[$key] = (float) $all[$key];
        }

        if ($values['avg_speed_kmh'] <= 0 || $values['cart_expiry_days'] <= 0) {
            throw new CartValidationException(
                'Checkout settings contain an invalid value.',
                ['settings' => ['Checkout settings contain an invalid value.']],
                'CHECKOUT_CONFIGURATION_UNAVAILABLE',
                503,
            );
        }

        return $values;
    }

    public function requireRestaurant(int $restaurantId, bool $lock = false): \App\Models\Restaurant
    {
        $restaurant = $this->carts->publicRestaurant($restaurantId, $lock);
        if ($restaurant === null) {
            $this->invalid('restaurant_id', 'This restaurant is not accepting customer orders.');
        }

        return $restaurant;
    }

    public function requireOrderableItem(int $restaurantId, int $itemId, bool $lock = false): MenuItem
    {
        $item = $this->carts->publicMenuItem($restaurantId, $itemId, $lock);
        if ($item === null) {
            $this->invalid('item_id', 'This menu item is not available from this restaurant.');
        }

        if ($item->daily_quantity !== null && (int) $item->quantity_left <= 0) {
            $this->invalid('quantity', "{$item->name} is sold out.");
        }

        return $item;
    }

    public function ensureCartStock(MenuItem $item, int $quantity): void
    {
        if ($quantity > 99) {
            $this->invalid('quantity', 'A menu item may not exceed 99 in one cart.');
        }
        if ($item->daily_quantity !== null && $quantity > (int) $item->quantity_left) {
            $this->invalid('quantity', "Only {$item->quantity_left} {$item->name} remaining.");
        }
    }

    public function loadCart(Cart $cart): Cart
    {
        return $cart->refresh()->load(['restaurant', 'items.menuItem.category']);
    }

    public function refreshExpiration(Cart $cart, int $days): void
    {
        $cart->forceFill([
            'expires_at' => $cart->items()->exists() ? now()->addDays($days) : null,
        ])->save();
    }

    public function parseId(string $value, string $field): int
    {
        if (! ctype_digit($value) || (int) $value < 1) {
            $this->invalid($field, 'The selected resource does not exist.');
        }

        return (int) $value;
    }

    public function invalid(string $field, string $message, int $orderIndex = 0): never
    {
        throw new CartValidationException(
            'The cart could not be updated.',
            [$field => [$message]],
        );
    }
}
