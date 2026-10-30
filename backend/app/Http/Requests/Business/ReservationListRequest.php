<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ReservationListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'in:pending,confirmed,declined,expired,cancelled,completed,no_show'],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date'],
            'table_id' => ['sometimes', 'integer', 'min:1'],
            'needs_attention' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator): void {
            if (
                $this->filled('from')
                && $this->filled('to')
                && strtotime((string) $this->input('to')) <= strtotime((string) $this->input('from'))
            ) {
                $validator->errors()->add('to', 'The end of the range must be after its start.');
            }
        });
    }
}
