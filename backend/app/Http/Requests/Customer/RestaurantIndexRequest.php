<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RestaurantIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'cuisine' => ['sometimes', 'nullable', 'string', 'max:60'],
            'service_mode' => ['sometimes', 'nullable', 'in:delivery,pickup'],
            'open_now' => ['sometimes', 'boolean'],
            'open_24_7' => ['sometimes', 'boolean'],
            'filipino_only' => ['sometimes', 'boolean'],
            'accepts_reservations' => ['sometimes', 'boolean'],
            'dietary' => ['sometimes', 'array', 'max:10'],
            'dietary.*' => ['string', 'max:60'],
            'featured' => ['sometimes', 'boolean'],
            'sort' => ['sometimes', 'in:nearest,rating,popularity'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:30'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('latitude') !== $this->filled('longitude')) {
                    $validator->errors()->add('latitude', 'Provide both coordinates to sort by distance.');
                    return;
                }

                if ($this->input('sort') === 'nearest' && ! $this->filled('latitude')) {
                    $validator->errors()->add('latitude', 'Provide coordinates to sort by distance.');
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
