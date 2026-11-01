<?php

namespace App\Http\Resources;

use App\Models\Cart;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerCartResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var Cart $cart */
        $cart = $this->resource;
        $items = $cart->items->map(function ($cartItem): array {
            $item = $cartItem->menuItem;
            $orderable = $item !== null
                && $item->lifecycle_status === 'published'
                && (bool) $item->is_available
                && ($item->daily_quantity === null || (int) $item->quantity_left > 0)
                && $item->category?->status === 'active';
            $price = $item === null ? 0.0 : (float) $item->price;

            return [
                'id' => (int) $cartItem->getKey(),
                'item_id' => (int) $cartItem->item_id,
                'name' => $item?->name ?? 'Unavailable menu item',
                'unit_price' => $price,
                'quantity' => (int) $cartItem->quantity,
                'note' => $cartItem->note,
                'is_orderable' => $orderable,
                'line_total' => round($price * (int) $cartItem->quantity, 2),
            ];
        });

        return [
            'id' => (int) $cart->getKey(),
            'restaurant_id' => (int) $cart->restaurant_id,
            'restaurant' => [
                'id' => (int) $cart->restaurant?->getKey(),
                'name' => $cart->restaurant?->name,
                'formatted_address' => $cart->restaurant?->formatted_address,
                'latitude' => $cart->restaurant?->latitude === null ? null : (float) $cart->restaurant->latitude,
                'longitude' => $cart->restaurant?->longitude === null ? null : (float) $cart->restaurant->longitude,
            ],
            'expires_at' => $cart->expires_at?->toISOString(),
            'items' => $items,
            'subtotal' => round((float) $items->sum('line_total'), 2),
        ];
    }
}
