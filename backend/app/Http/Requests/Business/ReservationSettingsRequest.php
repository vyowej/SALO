<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class ReservationSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'accepts_reservations' => ['required', 'boolean'],
            'confirm_mode' => ['required', 'in:manual,automatic'],
            'review_window_hours' => ['required', 'integer', 'min:1', 'max:65535'],
            'slot_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'dining_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'min_lead_hours' => ['required', 'integer', 'min:0', 'max:65535'],
            'max_months_ahead' => ['required', 'integer', 'min:1', 'max:65535'],
            'max_party_size' => ['required', 'integer', 'min:1', 'max:65535'],
            'grace_minutes' => ['required', 'integer', 'min:0', 'max:65535'],
            'cancel_cutoff_hours' => ['required', 'integer', 'min:0', 'max:65535'],
        ];
    }
}
