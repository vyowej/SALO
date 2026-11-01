<?php

namespace App\Http\Requests\Locations;

use App\Rules\WithinPhilippinesBounds;
use Illuminate\Foundation\Http\FormRequest;

class ReverseGeocodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'latitude' => ['required', 'numeric', 'between:-90,90', new WithinPhilippinesBounds],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ];
    }
}
