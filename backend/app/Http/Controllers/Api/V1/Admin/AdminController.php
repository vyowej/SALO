<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminActionRequest;
use App\Http\Requests\Admin\AdminListRequest;
use App\Http\Resources\AdminCollection;
use App\Http\Resources\AdminResource;
use App\Models\RestaurantApplication;
use App\Services\AdminService;
use App\Services\ScheduleGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function dashboard(AdminService $service): AdminResource
    {
        return AdminResource::make($service->dashboard());
    }

    public function index(AdminListRequest $request, AdminService $service): AdminCollection
    {
        $resource = (string) $request->route('resource');
        if ($resource === 'applications') {
            $this->authorize('viewAny', RestaurantApplication::class);
        }
        $result = $service->list($resource, $request->validated());

        return new AdminCollection($result['data'], $result['meta']);
    }

    public function show(Request $request, AdminService $service): AdminResource
    {
        $resource = (string) $request->route('resource');
        if ($resource === 'applications') {
            $this->authorize('viewAny', RestaurantApplication::class);
        }
        $record = $service->find($resource, (string) $request->route('id'));
        if ($resource === 'applications') {
            $requestedType = (string) $request->route('type');
            $matchesApplicationType = $record['type'] === $requestedType
                || ($requestedType === 'partner' && $record['type'] === 'restaurant');
            abort_unless($matchesApplicationType, 404);
        }

        return AdminResource::make($record);
    }

    public function store(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->create((string) $request->route('resource'), $request->validated(), $request->user()));
    }

    public function update(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->update((string) $request->route('resource'), (string) $request->route('id'), $request->validated(), $request->user()));
    }

    public function destroy(Request $request, AdminService $service): JsonResponse
    {
        $service->delete((string) $request->route('resource'), (string) $request->route('id'), $request->user());

        return response()->json([], 204);
    }

    public function userSuspend(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->setUserStatus((string) $request->route('id'), 'suspended', $request->user(), $request->validated('reason')));
    }

    public function userReactivate(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->setUserStatus((string) $request->route('id'), 'active', $request->user()));
    }

    public function restaurantStatus(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->setRestaurantStatus((string) $request->route('id'), $request->validated('status'), $request->user(), $request->validated('note')));
    }

    public function applicationApprove(AdminActionRequest $request, AdminService $service): AdminResource
    {
        $this->authorize('review', RestaurantApplication::class);

        return AdminResource::make($service->decideApplication((string) $request->route('type'), (string) $request->route('id'), true, $request->validated('note'), $request->user()));
    }

    public function applicationReject(AdminActionRequest $request, AdminService $service): AdminResource
    {
        $this->authorize('review', RestaurantApplication::class);

        return AdminResource::make($service->decideApplication((string) $request->route('type'), (string) $request->route('id'), false, $request->validated('note'), $request->user()));
    }

    public function applicationRequestRevision(AdminActionRequest $request, AdminService $service): AdminResource
    {
        $this->authorize('review', RestaurantApplication::class);

        return AdminResource::make($service->requestApplicationRevision(
            (string) $request->route('type'),
            (string) $request->route('id'),
            $request->validated('note'),
            $request->user(),
        ));
    }

    public function applicationStartReview(AdminActionRequest $request, AdminService $service): AdminResource
    {
        $this->authorize('review', RestaurantApplication::class);

        return AdminResource::make($service->startApplicationReview(
            (string) $request->route('type'),
            (string) $request->route('id'),
            $request->user(),
        ));
    }

    public function riderStatus(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->setRiderStatus((string) $request->route('id'), $request->validated('status'), $request->user()));
    }

    public function riderProofs(AdminListRequest $request, AdminService $service): AdminCollection
    {
        $params = $request->validated();
        $params['rider_id'] = (string) $request->route('id');
        $paged = $service->list('proofs', $params);
        $paged['data'] = array_map(fn ($proof) => array_diff_key($proof, ['rider_id' => true]), $paged['data']);

        return new AdminCollection($paged['data'], $paged['meta']);
    }

    public function cancelOrder(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->cancelOrder((string) $request->route('id'), $request->validated('reason'), $request->user()));
    }

    public function reservationStatus(AdminActionRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->setReservationStatus((string) $request->route('id'), $request->validated('status'), $request->validated('reason'), $request->user()));
    }

    public function report(AdminListRequest $request, AdminService $service): AdminResource
    {
        return AdminResource::make($service->report((string) $request->route('report'), $request->validated()));
    }

    public function history(AdminListRequest $request, AdminService $service): AdminCollection
    {
        $result = $service->list('history', $request->validated());

        return new AdminCollection($result['data'], $result['meta']);
    }

    public function calendar(AdminListRequest $request, AdminService $service): AdminCollection
    {
        return new AdminCollection($service->calendar($request->validated()));
    }

    public function settings(AdminService $service): AdminResource
    {
        return AdminResource::make($service->settings());
    }

    public function updateSettings(AdminActionRequest $request, AdminService $service): AdminResource
    {
        $result = $service->updateSettings($request->validated(), $request->user());
        unset($result['id']);

        return AdminResource::make($result);
    }

    public function generateSchedule(AdminActionRequest $request, AdminService $service, ScheduleGenerator $generator): AdminResource
    {
        $data = $request->validated();
        $result = $service->generateSchedules($data['date'], $data['slots'] ?? null, $request->user(), $generator);

        return AdminResource::make($result);
    }
}
