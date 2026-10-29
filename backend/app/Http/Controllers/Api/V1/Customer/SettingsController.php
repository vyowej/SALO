<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\UpdateSettingsRequest;
use App\Http\Resources\SettingsResource;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function show(Request $request, AuthService $auth): SettingsResource
    {
        /** @var User $user */
        $user = $request->user();

        return SettingsResource::make($auth->settings($user));
    }

    public function update(UpdateSettingsRequest $request, AuthService $auth): SettingsResource
    {
        /** @var User $user */
        $user = $request->user();

        return SettingsResource::make($auth->updateSettings($user, $request->validated()));
    }
}
