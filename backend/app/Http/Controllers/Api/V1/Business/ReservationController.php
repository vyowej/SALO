<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\ReservationListRequest;
use App\Http\Requests\Business\ReservationRescheduleRequest;
use App\Http\Requests\Business\ReservationStatusRequest;
use App\Http\Resources\ReservationResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\BusinessReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReservationController extends Controller
{
    public function index(ReservationListRequest $request, BusinessReservationService $service): JsonResponse
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('viewReservations', $restaurant);
        $result = $service->list($restaurant, $request->validated());

        return response()->json([
            'data' => ReservationResource::collection(collect($result['data']))->resolve(),
            'meta' => $result['meta'],
        ]);
    }

    public function show(Request $request, string $reservation, BusinessReservationService $service): ReservationResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('viewReservations', $restaurant);
        abort_unless(ctype_digit($reservation), 404);

        return ReservationResource::make(
            $service->show($restaurant, (int) $reservation),
        );
    }

    public function updateStatus(
        ReservationStatusRequest $request,
        string $reservation,
        BusinessReservationService $service,
    ): ReservationResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageReservations', $restaurant);
        abort_unless(ctype_digit($reservation), 404);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $data = $request->validated();

        return ReservationResource::make($service->updateStatus(
            $restaurant,
            $user,
            (int) $reservation,
            $data['status'],
            $data['reason'] ?? null,
        ));
    }

    public function reschedule(
        ReservationRescheduleRequest $request,
        string $reservation,
        BusinessReservationService $service,
    ): ReservationResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageReservations', $restaurant);
        abort_unless(ctype_digit($reservation), 404);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return ReservationResource::make($service->reschedule(
            $restaurant,
            $user,
            (int) $reservation,
            $request->validated(),
        ));
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }
}
