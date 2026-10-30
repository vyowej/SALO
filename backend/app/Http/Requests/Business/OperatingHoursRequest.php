<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class OperatingHoursRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'is_24_7' => ['required', 'boolean'],
            'hours' => ['required', 'array:monday,tuesday,wednesday,thursday,friday,saturday,sunday'],
            'hours.*' => ['array', 'max:4'],
            'hours.*.*.open_time' => ['required', 'date_format:H:i'],
            'hours.*.*.close_time' => ['required', 'date_format:H:i'],
            'hours.*.*.crosses_midnight' => ['required', 'boolean'],
        ];
    }
}
