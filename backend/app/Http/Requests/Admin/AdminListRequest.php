<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class AdminListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'search' => ['sometimes', 'string', 'max:200'],
            'sort' => ['sometimes', 'string', 'max:64'],
            'direction' => ['sometimes', 'in:asc,desc'],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date', 'after_or_equal:from'],
            'status' => ['sometimes', 'string', 'max:40'],
            'capability' => ['sometimes', 'in:customer,driver,admin'],
            'restaurant_id' => ['sometimes', 'string'],
            'city_code' => ['sometimes', 'string'],
            'fulfilment' => ['sometimes', 'in:delivery,pickup,walk_in'],
            'type' => ['sometimes', 'in:partner,rider'],
            'actor_id' => ['sometimes', 'string'],
            'subject_type' => ['sometimes', 'string'],
            'period' => ['sometimes', 'in:day,week,month'],
            'date' => ['sometimes', 'date'],
        ];
    }
}
