<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class SensitiveProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'proposed_changes' => [
                'required',
                'array:legal_name,psgc_code,street,house_no,latitude,longitude',
            ],
            'proposed_changes.legal_name' => ['sometimes', 'required', 'string', 'max:160'],
            'proposed_changes.psgc_code' => ['sometimes', 'required', 'string', 'max:12', 'exists:psgc_locations,code'],
            'proposed_changes.street' => ['sometimes', 'required', 'string', 'max:190'],
            'proposed_changes.house_no' => ['sometimes', 'nullable', 'string', 'max:40'],
            'proposed_changes.latitude' => ['sometimes', 'required', 'numeric', 'between:-90,90'],
            'proposed_changes.longitude' => ['sometimes', 'required', 'numeric', 'between:-180,180'],
            'permit_files' => ['sometimes', 'array', 'max:5'],
            'permit_files.*' => ['file', 'max:2048', 'mimes:pdf,jpg,jpeg,png,webp'],
            'permit_expiry_date' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
