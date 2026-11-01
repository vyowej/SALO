<?php

namespace App\Http\Controllers\Api\V1\Locations;

use App\Http\Controllers\Controller;
use App\Http\Requests\Locations\PsgcLocationRequest;
use App\Http\Requests\Locations\PsgcLocationSearchRequest;
use App\Models\PsgcLocation;
use App\Services\Contracts\LocationService;
use Illuminate\Http\Resources\Json\JsonResource;

class PsgcLocationController extends Controller
{
    public function index(PsgcLocationRequest $request, LocationService $locations): JsonResource
    {
        $this->authorize('viewAny', PsgcLocation::class);
        $data = $locations->list(
            $request->validated('level'),
            $request->validated('parent_code'),
            $request->validated('search'),
        );

        return JsonResource::make($data);
    }

    public function search(PsgcLocationSearchRequest $request, LocationService $locations): JsonResource
    {
        $this->authorize('viewAny', PsgcLocation::class);

        $validated = $request->validated();

        return JsonResource::make($locations->search(
            $validated['query'],
            $validated['level'] ?? null,
            $validated['parent_code'] ?? null,
        ));
    }
}
