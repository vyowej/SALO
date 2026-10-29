<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Services\AuthTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;

class PasswordResetController extends Controller
{
    public function forgot(ForgotPasswordRequest $request, AuthTokenService $tokens): JsonResponse
    {
        $tokens->sendPasswordReset($request->validated('email'));

        return JsonResource::make([
            'message' => 'If this email has an account, you will receive a reset link shortly.',
        ])->response();
    }

    public function reset(ResetPasswordRequest $request, AuthTokenService $tokens): JsonResponse
    {
        $tokens->resetPassword(
            $request->validated('email'),
            $request->validated('token'),
            $request->validated('password'),
        );

        return JsonResource::make([
            'message' => 'Your password has been reset. You can now sign in.',
        ])->response();
    }
}
