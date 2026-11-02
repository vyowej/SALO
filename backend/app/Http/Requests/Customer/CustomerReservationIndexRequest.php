<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CustomerReservationIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $toRules = ['sometimes', 'date'];
        if ($this->filled('from')) {
            $toRules[] = 'after_or_equal:from';
        }

        return [
            'status' => ['sometimes', 'string', Rule::in(['pending', 'confirmed', 'declined', 'expired', 'cancelled', 'completed', 'no_show'])],
            'from' => ['sometimes', 'date'],
            'to' => $toRules,
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }
}
