<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SetActiveModeRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\ActiveModeService;

class ActiveModeController extends Controller
{
    public function update(SetActiveModeRequest $request, ActiveModeService $service): UserResource
    {
        /** @var User $user */
        $user = $request->user();
        $updated = $service->activate(
            $user,
            $request->validated('mode'),
            $request->validated('selected_restaurant_id'),
            $request,
        );

        return UserResource::make($updated);
    }
}
