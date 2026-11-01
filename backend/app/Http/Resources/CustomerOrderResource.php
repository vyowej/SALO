<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->getKey(),
            'reference_code' => $this->reference_code,
            'checkout_group' => [
                'id' => (string) $this->checkoutGroup?->getKey(),
                'reference_code' => $this->checkoutGroup?->reference_code,
            ],
            'restaurant' => [
                'id' => (string) $this->restaurant?->getKey(),
                'name' => $this->restaurant?->name,
            ],
            'order_type' => $this->order_type,
            'scheduled_for' => $this->scheduled_for?->toISOString(),
            'status' => $this->status,
            'recipient_name' => $this->recipient_name,
            'recipient_phone' => $this->recipient_phone,
            'delivery_address_text' => $this->delivery_address_text,
            'items' => $this->items->map(fn ($item): array => [
                'id' => (string) $item->getKey(),
                'item_id' => (string) $item->item_id,
                'name' => $item->item_name_snapshot,
                'unit_price' => (float) $item->unit_price_snapshot,
                'quantity' => (int) $item->quantity,
                'note' => $item->note,
            ])->values(),
            'subtotal' => (float) $this->subtotal,
            'delivery_fee' => (float) $this->delivery_fee,
            'service_fee' => (float) $this->service_fee,
            'discount_amount' => (float) $this->discount_amount,
            'total_amount' => (float) $this->total_amount,
            'payments' => $this->payments->map(fn ($payment): array => [
                'method' => $payment->method,
                'status' => $payment->status,
                'amount' => (float) $payment->amount,
            ])->values(),
            'discount_redemptions' => $this->discountRedemptions->map(fn ($redemption): array => [
                'amount_applied' => (float) $redemption->amount_applied,
                'status' => $redemption->status,
            ])->values(),
            'cancel_reason' => $this->cancel_reason,
            'status_history' => $this->statusHistory->map(fn ($entry): array => [
                'from_status' => $entry->from_status,
                'to_status' => $entry->to_status,
                'reason' => $entry->reason,
                'changed_at' => $entry->changed_at?->toISOString(),
            ])->values(),
            'placed_at' => $this->placed_at?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
            'customer_confirmed_at' => $this->customer_confirmed_at?->toISOString(),
            'confirmation_method' => $this->confirmation_method,
            'restaurant_review' => $this->restaurantReview ? [
                'rating' => $this->restaurantReview->rating,
                'comment' => $this->restaurantReview->comment,
                'created_at' => $this->restaurantReview->created_at?->toISOString(),
            ] : null,
        ];
    }
}
