<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class AddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? ['required'] : ['sometimes', 'required'];

        return [
            'label' => [$this->isMethod('post') ? 'nullable' : 'sometimes', 'string', 'max:40'],
            'region' => [...$required, 'string', 'max:100'],
            'province' => [...$required, 'string', 'max:100'],
            'city_municipality' => [...$required, 'string', 'max:100'],
            'barangay' => [...$required, 'string', 'max:100'],
            'street' => [...$required, 'string', 'max:160'],
            'house_no' => ['sometimes', 'nullable', 'string', 'max:80'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'rider_note' => ['sometimes', 'nullable', 'string', 'max:300'],
        ];
    }
}
