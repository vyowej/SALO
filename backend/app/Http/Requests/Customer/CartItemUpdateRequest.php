<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class CartItemUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'quantity' => ['sometimes', 'required', 'integer', 'between:0,99'],
            'note' => ['sometimes', 'nullable', 'string', 'max:255'],
            'quantity_or_note' => ['prohibited'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if (! $this->has('quantity') && ! $this->has('note')) {
                $validator->errors()->add('quantity', 'Update the quantity or note.');
            }
        });
    }
}
