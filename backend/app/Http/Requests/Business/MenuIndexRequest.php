<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class MenuIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'status' => ['sometimes', 'nullable', 'in:draft,published,archived'],
            'category_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'include_archived_categories' => ['sometimes', 'boolean'],
        ];
    }
}
