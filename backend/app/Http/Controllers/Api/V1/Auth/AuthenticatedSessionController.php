<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request, AuthService $auth): JsonResponse
    {
        $user = $auth->login($request->validated(), $request);

        return UserResource::make($user)->response();
    }

    public function destroy(Request $request, AuthService $auth): JsonResponse
    {
        $auth->logout($request);

        return JsonResource::make(['message' => 'Logged out.'])->response();
    }
}
