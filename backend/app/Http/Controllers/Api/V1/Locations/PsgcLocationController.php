<?php

namespace App\Http\Controllers\Api\V1\Locations;

use App\Http\Controllers\Controller;
use App\Http\Requests\Locations\PsgcLocationRequest;
use App\Repositories\Contracts\PsgcLocationRepository;
use Illuminate\Http\Resources\Json\JsonResource;

class PsgcLocationController extends Controller
{
    public function index(PsgcLocationRequest $request, PsgcLocationRepository $locations): JsonResource
    {
        $data = $locations->listByLevelParent(
            $request->validated('level'),
            $request->validated('parent_code'),
            $request->validated('search'),
        );

        return JsonResource::make($data);
    }
}
