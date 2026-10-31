<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\DataAwareRule;
use Illuminate\Contracts\Validation\ValidationRule;

class WithinPhilippinesBounds implements DataAwareRule, ValidationRule
{
    private array $data = [];

    public function setData(array $data): static
    {
        $this->data = $data;

        return $this;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $longitudeAttribute = str_ends_with($attribute, '.latitude')
            ? substr($attribute, 0, -strlen('latitude')).'longitude'
            : 'longitude';
        $longitude = data_get($this->data, $longitudeAttribute);

        if (! is_numeric($value) || ! is_numeric($longitude)) {
            return;
        }

        $bounds = config('location.philippines_bounds');
        if (
            $value < $bounds['min_latitude']
            || $value > $bounds['max_latitude']
            || $longitude < $bounds['min_longitude']
            || $longitude > $bounds['max_longitude']
        ) {
            $fail('The pin must be within the supported Philippines coordinate bounds.');
        }
    }
}
