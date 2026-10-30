<?php

namespace App\Services;

use App\Models\Discount;
use Illuminate\Support\Carbon;

class DiscountQuoteService
{
    public function quote(
        ?Discount $discount,
        int $restaurantId,
        string $code,
        float $subtotal,
        float $deliveryFee,
        int $totalUses,
        int $customerUses,
        bool $hasPriorNonCancelledOrder,
        bool $isDelivery,
        ?Carbon $now = null,
    ): array {
        $now ??= now();
        $baseTotal = round(max(0, $subtotal) + max(0, $deliveryFee), 2);

        if ($subtotal < 0 || $deliveryFee < 0) {
            return $this->invalid("This code isn't valid for this order.", $baseTotal);
        }
        if (
            ! $discount instanceof Discount
            || strcasecmp(trim($discount->code), trim($code)) !== 0
            || ($discount->restaurant_id !== null && (int) $discount->restaurant_id !== $restaurantId)
            || ($discount->restaurant_id === null && $discount->funded_by !== 'platform')
            || ($discount->restaurant_id !== null && $discount->funded_by !== 'restaurant')
        ) {
            return $this->invalid("This code isn't valid for this order.", $baseTotal);
        }
        if (! $discount->is_active) {
            return $this->invalid('This code is not available right now.', $baseTotal);
        }
        if ($discount->starts_at->greaterThan($now)) {
            return $this->invalid(
                'This code starts on '.$discount->starts_at->copy()->timezone('Asia/Manila')->toDateString().'.',
                $baseTotal,
            );
        }
        if ($discount->ends_at->lessThan($now)) {
            return $this->invalid('This code is expired', $baseTotal);
        }
        if ($discount->usage_limit !== null && $totalUses >= (int) $discount->usage_limit) {
            return $this->invalid('This code has been fully claimed.', $baseTotal);
        }
        if ($customerUses >= (int) $discount->per_customer_limit) {
            return $this->invalid("You've already used this code.", $baseTotal);
        }
        if ($subtotal < (float) $discount->min_order_amount) {
            $remaining = (float) $discount->min_order_amount - $subtotal;

            return $this->invalid('Add ₱'.number_format($remaining, 2, '.', ',').' more to use this code.', $baseTotal);
        }
        if ($discount->first_order_only && $hasPriorNonCancelledOrder) {
            return $this->invalid("This code isn't valid for this order.", $baseTotal);
        }
        if (! in_array($discount->type, ['percentage', 'fixed', 'free_delivery'], true)) {
            return $this->invalid("This code isn't valid for this order.", $baseTotal);
        }

        $amount = match ($discount->type) {
            'percentage' => $subtotal * (float) $discount->value / 100,
            'fixed' => min($subtotal, (float) $discount->value),
            'free_delivery' => $isDelivery ? $deliveryFee : 0,
            default => 0,
        };
        if ($discount->type === 'free_delivery' && ! $isDelivery) {
            return $this->invalid("This code isn't valid for this order.", $baseTotal);
        }
        if ($discount->type === 'percentage') {
            if ($discount->max_discount !== null) {
                $amount = min($amount, (float) $discount->max_discount);
            }
            $amount = min($amount, $subtotal);
        }

        $amount = round(min(max(0, $subtotal + $deliveryFee), max(0, $amount)), 2);

        return [
            'valid' => true,
            'message' => null,
            'discount_amount' => $amount,
            'total_amount' => round(max(0, $subtotal + $deliveryFee - $amount), 2),
        ];
    }

    private function invalid(string $message, float $total): array
    {
        return [
            'valid' => false,
            'message' => $message,
            'discount_amount' => 0.0,
            'total_amount' => $total,
        ];
    }
}
