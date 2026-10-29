<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'notifications' => ['sometimes', 'boolean'],
            'promotions' => ['sometimes', 'boolean'],
            'reservationReminders' => ['sometimes', 'boolean'],
            'darkMode' => ['sometimes', 'boolean'],
            'soundAlerts' => ['sometimes', 'boolean'],
        ];
    }
}
