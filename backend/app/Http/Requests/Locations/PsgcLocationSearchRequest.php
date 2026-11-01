<?php

namespace App\Http\Requests\Locations;

use Illuminate\Foundation\Http\FormRequest;

class PsgcLocationSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'query' => ['required', 'string', 'min:2', 'max:100'],
            'level' => ['sometimes', 'in:region,province,city,barangay'],
            'parent_code' => ['sometimes', 'nullable', 'string', 'max:10', 'exists:psgc_locations,code'],
        ];
    }
}
