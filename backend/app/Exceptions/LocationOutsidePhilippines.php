<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class LocationOutsidePhilippines extends RuntimeException
{
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'error' => [
                'code' => 'LOCATION_OUTSIDE_PHILIPPINES',
                'message' => 'The selected pin could not be located in the Philippines. Move the pin within the supported area or enter the address manually.',
            ],
        ], 422);
    }
}
