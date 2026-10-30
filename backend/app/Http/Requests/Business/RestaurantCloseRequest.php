<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class RestaurantCloseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'closed' => ['required', 'boolean'],
            'reason' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
