<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\VerifyEmailRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthTokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmailVerificationController extends Controller
{
    public function send(Request $request, AuthTokenService $tokens): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tokens->sendEmailVerification($user);

        return JsonResource::make(['message' => 'If verification is needed, a code will be sent to your email.'])
            ->response();
    }

    public function verify(VerifyEmailRequest $request, AuthTokenService $tokens): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return UserResource::make($tokens->verifyEmail($user, $request->validated('code')));
    }
}
