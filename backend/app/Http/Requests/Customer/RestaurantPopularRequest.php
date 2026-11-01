<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RestaurantPopularRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'limit' => ['sometimes', 'integer', 'min:1', 'max:12'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('latitude') !== $this->filled('longitude')) {
                    $validator->errors()->add('latitude', 'Provide both coordinates to include distance.');
                    return;
                }

                if (! $this->filled('latitude') || ! $this->filled('longitude')) {
                    return;
                }

                $bounds = config('location.philippines_bounds');
                $latitude = (float) $this->input('latitude');
                $longitude = (float) $this->input('longitude');
                if ($latitude < $bounds['min_latitude'] || $latitude > $bounds['max_latitude']
                    || $longitude < $bounds['min_longitude'] || $longitude > $bounds['max_longitude']) {
                    $validator->errors()->add('latitude', 'Coordinates must be within the supported Philippines bounds.');
                }
            },
        ];
    }
}
