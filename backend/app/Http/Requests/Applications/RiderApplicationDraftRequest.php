<?php

namespace App\Http\Requests\Applications;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RiderApplicationDraftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vehicle_type' => ['sometimes', 'required', Rule::in(['motorcycle', 'bicycle', 'e_scooter', 'walker'])],
            'first_name' => ['sometimes', 'required', 'string', 'max:80'],
            'middle_name' => ['sometimes', 'nullable', 'string', 'max:80'],
            'last_name' => ['sometimes', 'required', 'string', 'max:80'],
            'suffix' => ['sometimes', 'nullable', 'string', 'max:20'],
            'birthday' => ['sometimes', 'required', 'date', 'before_or_equal:'.now()->subYears(18)->toDateString()],
            'mobile' => ['sometimes', 'required', 'string', 'max:20'],
            'preferred_shift_ids' => ['sometimes', 'array', 'min:1'],
            'preferred_shift_ids.*' => ['integer', 'distinct', 'exists:shifts,id'],
            'psgc_code' => ['sometimes', 'nullable', 'string', 'max:12', 'exists:psgc_locations,code'],
            'street' => ['sometimes', 'nullable', 'string', 'max:190'],
            'house_no' => ['sometimes', 'nullable', 'string', 'max:40'],
            'home_lat' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'home_lng' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'plate_number' => ['sometimes', 'nullable', 'string', 'max:20'],
            'ewallet_account_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'declared_clearance_tin' => ['sometimes', 'boolean'],
        ];
    }
}
