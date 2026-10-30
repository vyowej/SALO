<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReservationStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['confirmed', 'declined', 'cancelled', 'completed', 'no_show'])],
            'reason' => ['required_if:status,declined,cancelled', 'nullable', 'string', 'max:500'],
        ];
    }
}
