<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class CartItemStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'item_id' => ['required', 'integer', 'min:1'],
            'quantity' => ['required', 'integer', 'between:1,99'],
            'note' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
