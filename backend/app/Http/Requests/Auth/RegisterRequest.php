<?php

namespace App\Http\Requests\Auth;

use App\Rules\WithinPhilippinesBounds;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:254'],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => ['required', 'string', 'confirmed', 'min:8', 'regex:/[A-Za-z]/', 'regex:/\d/'],
            'address' => ['sometimes', 'nullable', 'array'],
            'address.psgc_code' => ['nullable', 'string', 'max:12', 'exists:psgc_locations,code'],
            'address.label' => ['nullable', 'string', 'max:40'],
            'address.address_type' => ['nullable', 'in:home,work,church,other'],
            'address.custom_label' => ['nullable', 'string', 'max:60'],
            'address.street' => ['nullable', 'string', 'max:190'],
            'address.house_no' => ['nullable', 'string', 'max:40'],
            'address.latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:address.longitude', new WithinPhilippinesBounds],
            'address.longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:address.latitude'],
            'address.delivery_note' => ['nullable', 'string', 'max:255'],
            'address.is_default' => ['sometimes', 'boolean'],
        ];
    }
}
