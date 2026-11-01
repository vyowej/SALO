<?php

namespace App\Http\Resources;

use App\Models\CheckoutGroup;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CheckoutGroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var CheckoutGroup $group */
        $group = $this->resource;
        $orders = $group->orders->map(fn ($order): array => [
            'id' => (int) $order->getKey(),
            'reference_code' => $order->reference_code,
            'restaurant_id' => (int) $order->restaurant_id,
            'restaurant_name' => $order->restaurant?->name,
            'order_type' => $order->order_type,
            'status' => $order->status,
            'subtotal' => (float) $order->subtotal,
            'delivery_fee' => (float) $order->delivery_fee,
            'service_fee' => (float) $order->service_fee,
            'discount_amount' => (float) $order->discount_amount,
            'total_amount' => (float) $order->total_amount,
            'items' => $order->items->map(fn ($item): array => [
                'item_id' => (int) $item->item_id,
                'name' => $item->item_name_snapshot,
                'unit_price' => (float) $item->unit_price_snapshot,
                'quantity' => (int) $item->quantity,
                'note' => $item->note,
            ])->values(),
        ])->values();

        return [
            'id' => (int) $group->getKey(),
            'reference_code' => $group->reference_code,
            'placed_at' => $group->placed_at?->toISOString(),
            'orders' => $orders,
            'grand_total' => round((float) $orders->sum('total_amount'), 2),
        ];
    }
}
