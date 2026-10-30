<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class RestaurantPhotoUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'alt_text' => ['sometimes', 'nullable', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'between:0,65535'],
            'is_primary' => ['sometimes', 'boolean'],
        ];
    }
}
