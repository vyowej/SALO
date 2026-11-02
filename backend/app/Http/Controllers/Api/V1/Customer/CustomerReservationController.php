<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CustomerReservationCancelRequest;
use App\Http\Requests\Customer\CustomerReservationIndexRequest;
use App\Http\Requests\Customer\CustomerReservationStoreRequest;
use App\Http\Requests\Customer\ReservationSlotsRequest;
use App\Http\Resources\CustomerReservationResource;
use App\Models\Reservation;
use App\Models\User;
use App\Services\CustomerReservationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerReservationController extends Controller
{
    public function slots(
        ReservationSlotsRequest $request,
        CustomerReservationService $reservations,
        string $restaurant,
    ): JsonResponse {
        abort_unless(ctype_digit($restaurant), 404);
        $restaurantModel = $reservations->publicRestaurant((int) $restaurant);
        $this->authorize('viewCustomer', $restaurantModel);
        $filters = $request->validated();

        return response()->json(['data' => $reservations->slots(
            $restaurantModel,
            $filters['date'],
            (int) $filters['guest_count'],
            isset($filters['duration_minutes']) ? (int) $filters['duration_minutes'] : null,
        )]);
    }

    public function store(
        CustomerReservationStoreRequest $request,
        CustomerReservationService $reservations,
    ): JsonResponse {
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $data = $request->validated();
        $restaurant = $reservations->publicRestaurant((int) $data['restaurant_id']);
        $this->authorize('create', [Reservation::class, $restaurant]);

        $reservation = $reservations->create((int) $user->getKey(), $data);
        $resource = CustomerReservationResource::make($reservation);

        return response()->json(['data' => $resource->resolve($request)], 201);
    }

    public function index(
        CustomerReservationIndexRequest $request,
        CustomerReservationService $reservations,
    ): AnonymousResourceCollection {
        $this->authorize('viewAny', Reservation::class);

        return CustomerReservationResource::collection($reservations->list(
            (int) $request->user()->getAuthIdentifier(),
            $request->validated(),
        ));
    }

    public function show(Request $request, CustomerReservationService $reservations, string $reservation): CustomerReservationResource
    {
        abort_unless(ctype_digit($reservation), 404);
        $owned = $reservations->find((int) $request->user()->getAuthIdentifier(), (int) $reservation);
        $this->authorize('view', $owned);

        return CustomerReservationResource::make($owned);
    }

    public function cancel(
        CustomerReservationCancelRequest $request,
        CustomerReservationService $reservations,
        string $reservation,
    ): CustomerReservationResource {
        abort_unless(ctype_digit($reservation), 404);
        $userId = (int) $request->user()->getAuthIdentifier();
        $owned = $reservations->find($userId, (int) $reservation);
        $this->authorize('cancel', $owned);

        return CustomerReservationResource::make($reservations->cancel(
            $userId,
            (int) $reservation,
            $request->validated('reason'),
        ));
    }
}
