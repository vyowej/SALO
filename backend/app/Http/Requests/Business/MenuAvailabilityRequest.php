<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class MenuAvailabilityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['is_available' => ['required', 'boolean']];
    }
}
