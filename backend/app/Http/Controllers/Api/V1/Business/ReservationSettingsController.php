<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\ReservationSettingsRequest;
use App\Http\Resources\ReservationSettingsResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\BusinessReservationService;
use Illuminate\Http\Request;

class ReservationSettingsController extends Controller
{
    public function show(Request $request, BusinessReservationService $service): ReservationSettingsResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('viewReservations', $restaurant);

        return ReservationSettingsResource::make($service->settings($restaurant));
    }

    public function update(
        ReservationSettingsRequest $request,
        BusinessReservationService $service,
    ): ReservationSettingsResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageReservations', $restaurant);
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return ReservationSettingsResource::make(
            $service->updateSettings($restaurant, $user, $request->validated()),
        );
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }
}
