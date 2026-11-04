<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RiderZoneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        return [
            'name' => [
                $required,
                'string',
                'max:100',
                Rule::unique('zones', 'name')->ignore($this->route('zone')),
            ],
            'psgc_code' => ['sometimes', 'nullable', 'string', 'exists:psgc_locations,code'],
            'center_lat' => [$required, 'numeric', 'between:-90,90'],
            'center_lng' => [$required, 'numeric', 'between:-180,180'],
            'radius_km' => [$required, 'numeric', 'gt:0', 'max:999.99'],
            'is_active' => ['sometimes', 'boolean'],
            'capacities' => [$this->isMethod('POST') ? 'required' : 'prohibited', 'array', 'min:1'],
            'capacities.*.shift_id' => ['required', 'integer', 'distinct', 'exists:shifts,id'],
            'capacities.*.max_riders' => ['required', 'integer', 'min:1', 'max:65535'],
        ];
    }
}
