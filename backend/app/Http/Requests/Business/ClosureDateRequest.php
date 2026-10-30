<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class ClosureDateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'closure_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'reason' => ['required', 'string', 'max:255'],
        ];
    }
}
