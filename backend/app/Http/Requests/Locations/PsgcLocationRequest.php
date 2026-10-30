<?php

namespace App\Http\Requests\Locations;

use Illuminate\Foundation\Http\FormRequest;

class PsgcLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'level' => ['required', 'in:region,province,city,barangay'],
            'parent_code' => ['required_unless:level,region', 'nullable', 'string', 'max:10', 'exists:psgc_locations,code'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
        ];
    }
}
