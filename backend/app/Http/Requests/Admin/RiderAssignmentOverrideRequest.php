<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class RiderAssignmentOverrideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'zone_id' => ['required', 'integer', 'exists:zones,id'],
            'shift_id' => ['required', 'integer', 'exists:shifts,id'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ];
    }
}
