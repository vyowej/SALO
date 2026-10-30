<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class ReservationRescheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'start_at' => ['required', 'date'],
            'duration_minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'table_id' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
