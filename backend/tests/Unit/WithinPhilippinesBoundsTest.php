<?php

namespace Tests\Unit;

use App\Rules\WithinPhilippinesBounds;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class WithinPhilippinesBoundsTest extends TestCase
{
    public function test_a_pin_inside_the_configured_bounds_is_accepted(): void
    {
        foreach ([
            ['latitude' => 4.5, 'longitude' => 116.0],
            ['latitude' => 21.5, 'longitude' => 127.5],
            ['latitude' => 14.6, 'longitude' => 121.0],
        ] as $pin) {
            $validator = Validator::make($pin, [
                'latitude' => ['required', 'numeric', new WithinPhilippinesBounds],
                'longitude' => ['required', 'numeric'],
            ]);

            self::assertTrue($validator->passes());
        }
    }

    public function test_a_pin_outside_the_configured_bounds_has_a_clear_validation_error(): void
    {
        foreach ([
            ['latitude' => 25.0, 'longitude' => 121.0],
            ['latitude' => 14.6, 'longitude' => 128.0],
        ] as $pin) {
            $validator = Validator::make($pin, [
                'latitude' => ['required', 'numeric', new WithinPhilippinesBounds],
                'longitude' => ['required', 'numeric'],
            ]);

            self::assertFalse($validator->passes());
            self::assertSame(
                'The pin must be within the supported Philippines coordinate bounds.',
                $validator->errors()->first('latitude'),
            );
        }
    }
}
