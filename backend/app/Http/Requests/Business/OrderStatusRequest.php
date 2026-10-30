<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class OrderStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:confirmed,preparing,ready,completed,rejected,cancelled'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
