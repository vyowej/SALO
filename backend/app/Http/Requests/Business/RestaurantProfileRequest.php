<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class RestaurantProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'category' => ['sometimes', 'required', 'string', 'max:60'],
            'cuisine' => ['sometimes', 'nullable', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:40'],
            'delivery_radius_km' => ['sometimes', 'nullable', 'numeric', 'gt:0', 'max:500'],
            'prep_minutes' => ['sometimes', 'nullable', 'integer', 'between:1,1440'],
        ];
    }
}
