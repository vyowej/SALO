<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class MenuBulkPublishRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'item_ids' => ['required', 'array', 'min:1', 'max:100'],
            'item_ids.*' => ['required', 'integer', 'min:1', 'distinct'],
        ];
    }
}
