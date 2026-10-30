<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\BusinessCalendarRequest;
use App\Http\Resources\BusinessCalendarEventResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\BusinessCalendarService;
use Illuminate\Http\JsonResponse;

class BusinessCalendarController extends Controller
{
    public function index(BusinessCalendarRequest $request, BusinessCalendarService $service): JsonResponse
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);
        $this->authorize('viewCalendar', $restaurant);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $events = $service->events(
            $restaurant,
            $request->validated('start'),
            $request->validated('end'),
            $user->can('viewReservations', $restaurant),
        );

        return response()->json([
            'data' => BusinessCalendarEventResource::collection(collect($events))->resolve(),
        ]);
    }
}
