<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminAccountRequest;
use App\Services\AdminAccountService;
use Illuminate\Http\JsonResponse;

class AdminAccountController extends Controller
{
    public function index(AdminAccountRequest $request, AdminAccountService $accounts): JsonResponse
    {
        return response()->json($accounts->list($request->validated()));
    }

    public function show(string $user, AdminAccountService $accounts): JsonResponse
    {
        return response()->json(['data' => $accounts->find($user)]);
    }

    public function store(AdminAccountRequest $request, AdminAccountService $accounts): JsonResponse
    {
        return response()->json([
            'data' => $accounts->create($request->validated(), $request->user()),
        ], 201);
    }

    public function update(
        AdminAccountRequest $request,
        AdminAccountService $accounts,
        string $user,
    ): JsonResponse {
        return response()->json([
            'data' => $accounts->update($user, $request->validated(), $request->user()),
        ]);
    }

    public function setStatus(
        AdminAccountRequest $request,
        AdminAccountService $accounts,
        string $user,
    ): JsonResponse {
        return response()->json([
            'data' => $accounts->setStatus($user, $request->validated('status'), $request->user()),
        ]);
    }
}
