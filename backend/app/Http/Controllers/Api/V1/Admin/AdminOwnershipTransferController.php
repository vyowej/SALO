<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminOwnershipTransferRequest;
use App\Http\Resources\TeamResource;
use App\Models\Restaurant;
use App\Services\TeamService;

class AdminOwnershipTransferController extends Controller
{
    public function __invoke(AdminOwnershipTransferRequest $request, Restaurant $restaurant, TeamService $service): TeamResource
    {
        return TeamResource::make($service->adminTransferOwnership(
            $restaurant,
            $request->user(),
            (int) $request->validated('manager_id'),
            $request->validated('reason'),
        ));
    }
}
