<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckoutQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'orders' => ['required', 'array', 'min:1', 'max:20'],
            'orders.*.restaurant_id' => ['required', 'integer', 'min:1', 'distinct'],
            'orders.*.order_type' => ['required', Rule::in(['delivery', 'pickup'])],
            'orders.*.address_id' => ['required_if:orders.*.order_type,delivery', 'nullable', 'integer', 'min:1'],
            'orders.*.recipient_name' => ['nullable', 'string', 'max:120'],
            'orders.*.recipient_phone' => ['nullable', 'string', 'max:20'],
            'orders.*.payment_method' => ['required', Rule::in(['cod', 'pay_at_pickup', 'online_bank', 'gcash'])],
            'orders.*.discount_code' => ['nullable', 'string', 'max:40'],
            'orders.*.scheduled_for' => ['nullable', 'date'],
        ];
    }
}
