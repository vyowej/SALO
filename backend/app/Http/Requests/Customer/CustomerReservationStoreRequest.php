<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class CustomerReservationStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'restaurant_id' => ['required', 'integer', 'min:1'],
            'table_id' => ['required', 'integer', 'min:1'],
            'start_at' => ['required', 'date'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'guest_count' => ['required', 'integer', 'min:1', 'max:50'],
            'reserved_for_name' => ['required', 'string', 'max:120'],
            'contact_phone' => ['required', 'string', 'max:20'],
            'special_request' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
