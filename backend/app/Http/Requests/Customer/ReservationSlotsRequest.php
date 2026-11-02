<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class ReservationSlotsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'guest_count' => ['required', 'integer', 'min:1', 'max:50'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
        ];
    }
}
