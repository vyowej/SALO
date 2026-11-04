<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RiderAssignmentOverrideRequest;
use App\Http\Requests\Admin\RiderStatusRequest;
use App\Http\Requests\Admin\RiderZoneCapacityRequest;
use App\Http\Requests\Admin\RiderZoneRequest;
use App\Http\Resources\RiderProfileResource;
use App\Models\RiderProfile;
use App\Services\RiderSchedulingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiderSchedulingController extends Controller
{
    public function overview(RiderSchedulingService $service): JsonResponse
    {
        $this->authorize('manageScheduling', RiderProfile::class);

        return response()->json(['data' => $service->overview()]);
    }

    public function assignments(Request $request, RiderSchedulingService $service): JsonResponse
    {
        $this->authorize('manageScheduling', RiderProfile::class);
        $filters = $request->validate([
            'status' => ['sometimes', 'in:assigned,waitlisted'],
            'shift_id' => ['sometimes', 'integer', 'exists:shifts,id'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $page = $service->assignments($filters);

        return response()->json([
            'data' => $page->getCollection()->map(fn ($assignment): array => [
                'id' => (string) $assignment->getKey(),
                'rider_id' => (string) $assignment->rider_id,
                'rider_name' => $assignment->rider?->user?->name,
                'rider_status' => $assignment->rider?->status,
                'application_status' => $assignment->rider?->application_status,
                'zone_id' => $assignment->zone_id === null ? null : (string) $assignment->zone_id,
                'zone_name' => $assignment->zone?->name,
                'shift_id' => (string) $assignment->shift_id,
                'shift_name' => $assignment->shift?->name,
                'shift_start_time' => substr((string) $assignment->shift?->start_time, 0, 5),
                'shift_end_time' => substr((string) $assignment->shift?->end_time, 0, 5),
                'status' => $assignment->status,
                'assigned_by' => $assignment->assigned_by,
                'reason' => $assignment->reason,
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function storeZone(RiderZoneRequest $request, RiderSchedulingService $service): JsonResponse
    {
        $this->authorize('manageScheduling', RiderProfile::class);
        $zone = $service->createZone($request->validated(), $request->user());

        return response()->json(['data' => $zone], 201);
    }

    public function updateZone(RiderZoneRequest $request, int $zone, RiderSchedulingService $service): JsonResponse
    {
        $this->authorize('manageScheduling', RiderProfile::class);

        return response()->json(['data' => $service->updateZone($zone, $request->validated(), $request->user())]);
    }

    public function setCapacity(
        RiderZoneCapacityRequest $request,
        int $zone,
        int $shift,
        RiderSchedulingService $service,
    ): JsonResponse {
        $this->authorize('manageScheduling', RiderProfile::class);

        return response()->json(['data' => $service->setCapacity(
            $zone,
            $shift,
            (int) $request->validated('max_riders'),
            $request->user(),
        )]);
    }

    public function override(
        RiderAssignmentOverrideRequest $request,
        int $rider,
        int $assignment,
        RiderSchedulingService $service,
    ): JsonResponse {
        $this->authorize('manageScheduling', RiderProfile::class);
        $result = $service->overrideAssignment(
            $rider,
            $assignment,
            (int) $request->validated('zone_id'),
            (int) $request->validated('shift_id'),
            $request->validated('reason'),
            $request->user(),
        );

        return response()->json(['data' => [
            'id' => (string) $result->getKey(),
            'rider_id' => (string) $result->rider_id,
            'zone_id' => (string) $result->zone_id,
            'shift_id' => (string) $result->shift_id,
            'status' => $result->status,
            'assigned_by' => $result->assigned_by,
            'assigned_by_user_id' => (string) $result->assigned_by_user_id,
            'reason' => $result->reason,
        ]]);
    }

    public function setRiderStatus(
        RiderStatusRequest $request,
        int $rider,
        RiderSchedulingService $service,
    ): RiderProfileResource {
        $this->authorize('manageScheduling', RiderProfile::class);

        return RiderProfileResource::make($service->changeRiderStatus(
            $rider,
            $request->validated('status'),
            $request->user(),
        ));
    }
}
