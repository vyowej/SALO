<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MenuCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $restaurantId = $this->route('restaurant');
        $categoryId = $this->route('category');
        $nameRequired = $this->isMethod('post') ? 'required' : 'sometimes';
        $uniqueName = Rule::unique('menu_categories', 'name')->where('restaurant_id', $restaurantId);
        if (is_numeric($categoryId)) {
            $uniqueName->ignore((int) $categoryId);
        }

        return [
            'name' => [
                $nameRequired,
                'string',
                'max:120',
                $uniqueName,
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
            'status' => ['sometimes', 'in:active,archived'],
        ];
    }
}
