<?php

namespace App\Http\Requests\Customer;

use App\Rules\WithinPhilippinesBounds;
use Illuminate\Foundation\Http\FormRequest;

class AddressRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $label = $this->input('label');
        if (! is_string($label)) {
            return;
        }

        $normalized = match (strtolower(trim($label))) {
            'home' => 'Home',
            'work', 'office' => 'Work',
            'church' => 'Church',
            'school' => 'School',
            'other' => 'Other',
            default => $label,
        };

        $this->merge(['label' => $normalized]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $legacyLeafOnly = $this->exists('psgc_code') && ! $this->exists('barangay_code');

        return [
            'country_code' => ['sometimes', 'in:PH'],
            'province_code' => ['sometimes', 'nullable', 'string', 'max:12'],
            'city_code' => ['sometimes', 'nullable', 'string', 'max:12'],
            'barangay_code' => ['sometimes', 'nullable', 'string', 'max:12'],
            'psgc_code' => ['sometimes', 'nullable', 'string', 'max:12'],
            'label' => ['sometimes', 'string', 'in:Home,Work,Church,School,Other'],
            'address_type' => ['sometimes', 'in:home,work,church,other'],
            'custom_label' => ['sometimes', 'nullable', 'string', 'max:60'],
            'street' => [$this->isMethod('post') ? 'required' : 'sometimes', 'string', 'max:190'],
            'house_no' => ['sometimes', 'nullable', 'string', 'max:40'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90', 'required_with:longitude', new WithinPhilippinesBounds],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'delivery_note' => ['sometimes', 'nullable', 'string', 'max:255'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }
}
