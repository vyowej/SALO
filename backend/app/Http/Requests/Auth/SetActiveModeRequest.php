<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class SetActiveModeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'mode' => ['required', 'in:customer,business,driver,admin'],
            'selected_restaurant_id' => ['nullable', 'integer', 'required_if:mode,business'],
        ];
    }
}
