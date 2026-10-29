<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class CurrentAccountController extends Controller
{
    public function show(Request $request): UserResource
    {
        return UserResource::make($request->user());
    }
}
