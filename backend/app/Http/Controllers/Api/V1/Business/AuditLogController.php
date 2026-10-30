<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\AuditLogListRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\Restaurant;
use App\Repositories\Contracts\AuditLogRepository;
use Illuminate\Http\JsonResponse;

class AuditLogController extends Controller
{
    public function index(AuditLogListRequest $request, AuditLogRepository $repository): JsonResponse
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);
        $logs = $repository->paginateForRestaurant((int) $restaurant->getKey(), $request->validated());

        return response()->json([
            'data' => AuditLogResource::collection($logs->getCollection())->resolve(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }
}
