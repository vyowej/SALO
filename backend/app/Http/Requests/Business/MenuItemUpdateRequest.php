<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class MenuItemUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => ['sometimes', 'required', 'integer', 'min:1'],
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'price' => ['sometimes', 'required', 'numeric', 'gt:0', 'decimal:0,2'],
            'price_change_acknowledged' => ['sometimes', 'boolean'],
            'lifecycle_status' => ['sometimes', 'in:draft,published'],
            'is_available' => ['sometimes', 'boolean'],
            'daily_quantity' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'prep_minutes' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:1440'],
            'dietary_tag_ids' => ['sometimes', 'array'],
            'dietary_tag_ids.*' => ['integer', 'distinct', 'exists:dietary_tags,id'],
        ];
    }
}
