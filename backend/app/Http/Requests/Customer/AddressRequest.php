<?php

namespace App\Http\Requests\Customer;

use App\Rules\WithinPhilippinesBounds;
use Illuminate\Foundation\Http\FormRequest;

class AddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'psgc_code' => [$this->isMethod('post') ? 'required' : 'sometimes', 'string', 'max:12', 'exists:psgc_locations,code'],
            'label' => ['sometimes', 'string', 'max:40'],
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
