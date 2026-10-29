<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\DeactivateAccountRequest;
use App\Http\Requests\Customer\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileController extends Controller
{
    public function show(Request $request): UserResource
    {
        return UserResource::make($request->user());
    }

    public function update(UpdateProfileRequest $request, AuthService $auth): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return UserResource::make($auth->updateProfile($user, $request->validated()));
    }

    public function destroy(DeactivateAccountRequest $request, AuthService $auth): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $auth->deactivate(
            $user,
            $request->validated('password'),
            $request->validated('reason'),
            $request,
        );

        return JsonResource::make(['message' => 'Account deactivated.'])->response();
    }
}
