<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

class RegisteredUserController extends Controller
{
    public function store(RegisterRequest $request, AuthService $auth): JsonResponse
    {
        $user = $auth->register($request->validated(), $request);

        return UserResource::make($user)->response()->setStatusCode(201);
    }
}
