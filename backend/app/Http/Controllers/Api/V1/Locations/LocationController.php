<?php

namespace App\Http\Controllers\Api\V1\Locations;

use App\Http\Controllers\Controller;
use App\Http\Requests\Locations\PlaceSearchRequest;
use App\Http\Requests\Locations\ReverseGeocodeRequest;
use App\Models\PsgcLocation;
use App\Services\Contracts\LocationService;
use Illuminate\Http\Resources\Json\JsonResource;

class LocationController extends Controller
{
    public function searchPlaces(PlaceSearchRequest $request, LocationService $locations): JsonResource
    {
        $this->authorize('viewAny', PsgcLocation::class);
        $validated = $request->validated();

        return JsonResource::make($locations->searchPlaces($validated['q'], $validated['limit'] ?? 5));
    }

    public function reverseGeocode(ReverseGeocodeRequest $request, LocationService $locations): JsonResource
    {
        $this->authorize('viewAny', PsgcLocation::class);
        $validated = $request->validated();

        return JsonResource::make($locations->reverseGeocode(
            (float) $validated['latitude'],
            (float) $validated['longitude'],
        ));
    }
}
