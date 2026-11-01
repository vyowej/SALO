<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class LocationProviderUnavailable extends RuntimeException
{
    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'error' => [
                'code' => 'LOCATION_PROVIDER_UNAVAILABLE',
                'message' => 'Location services are temporarily unavailable. You can continue by entering the address manually.',
            ],
        ], 503);
    }
}
