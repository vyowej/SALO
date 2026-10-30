<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\BusinessWorkspaceRequest;
use App\Http\Resources\BusinessWorkspaceResource;
use App\Models\Restaurant;
use App\Services\BusinessWorkspaceService;

class BusinessWorkspaceController extends Controller
{
    public function show(BusinessWorkspaceRequest $request, BusinessWorkspaceService $service): BusinessWorkspaceResource
    {
        $restaurant = $request->attributes->get('restaurant');
        $membership = $request->attributes->get('restaurant_membership');
        abort_unless($restaurant instanceof Restaurant && is_array($membership), 404);

        return BusinessWorkspaceResource::make($service->show($restaurant, $membership));
    }
}
