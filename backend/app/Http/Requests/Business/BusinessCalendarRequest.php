<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class BusinessCalendarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'start' => ['required', 'date'],
            'end' => ['required', 'date', 'after:start'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->filled('start') && $this->filled('end')) {
                $start = strtotime((string) $this->input('start'));
                $end = strtotime((string) $this->input('end'));
                if ($start !== false && $end !== false && $end - $start > 93 * 86400) {
                    $validator->errors()->add('end', 'The calendar range cannot exceed 93 days.');
                }
            }
        });
    }
}
