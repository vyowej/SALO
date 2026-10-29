<?php

namespace App\Http\Requests\Auth;

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
            'address.label' => ['nullable', 'string', 'max:40'],
            'address.region' => ['required_with:address', 'string', 'max:100'],
            'address.province' => ['required_with:address', 'string', 'max:100'],
            'address.city_municipality' => ['required_with:address', 'string', 'max:100'],
            'address.barangay' => ['required_with:address', 'string', 'max:100'],
            'address.street' => ['required_with:address', 'string', 'max:160'],
            'address.house_no' => ['nullable', 'string', 'max:80'],
            'address.latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:address.longitude'],
            'address.longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:address.latitude'],
            'address.rider_note' => ['nullable', 'string', 'max:300'],
        ];
    }
}
