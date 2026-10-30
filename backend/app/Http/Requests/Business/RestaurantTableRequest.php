<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RestaurantTableRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('table_number')) {
            $this->merge(['table_number' => trim((string) $this->input('table_number'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tableId = $this->route('table');
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';
        $uniqueNumber = Rule::unique('restaurant_tables', 'table_number')
            ->where('restaurant_id', (int) $this->route('restaurant'));
        if ($tableId !== null) {
            $uniqueNumber->ignore((int) $tableId);
        }

        return [
            'table_number' => [
                $required,
                'string',
                'max:80',
                $uniqueNumber,
            ],
            'capacity' => [$required, 'integer', 'min:1', 'max:65535'],
            'area' => ['sometimes', 'nullable', 'string', 'max:120'],
            'status' => ['sometimes', 'in:active,maintenance,inactive'],
        ];
    }
}
