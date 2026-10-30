<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class MenuItemCreateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'min:1'],
            'name' => ['required', 'string', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'price' => ['required', 'numeric', 'gt:0', 'decimal:0,2'],
            'lifecycle_status' => ['sometimes', 'in:draft,published'],
            'is_available' => ['sometimes', 'boolean'],
            'daily_quantity' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'prep_minutes' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:1440'],
            'dietary_tag_ids' => ['sometimes', 'array'],
            'dietary_tag_ids.*' => ['integer', 'distinct', 'exists:dietary_tags,id'],
            'file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }
}
