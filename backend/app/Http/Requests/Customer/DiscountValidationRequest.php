<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DiscountValidationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'restaurant_id' => ['required', 'integer', 'min:1'],
            'code' => ['required', 'string', 'max:40'],
            'order_type' => ['required', Rule::in(['delivery', 'pickup'])],
            'payment_method' => ['required', Rule::in(['cod', 'pay_at_pickup', 'online_bank', 'gcash'])],
            'address_id' => ['nullable', 'integer', 'min:1'],
            'subtotal' => ['sometimes', 'numeric', 'min:0'],
        ];
    }
}
