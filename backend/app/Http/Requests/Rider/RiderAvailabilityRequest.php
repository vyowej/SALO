<?php

namespace App\Http\Requests\Rider;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RiderAvailabilityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'availability' => ['required', Rule::in(['online', 'offline'])],
            'latitude' => ['required_if:availability,online', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['required_if:availability,online', 'nullable', 'numeric', 'between:-180,180'],
        ];
    }
}
