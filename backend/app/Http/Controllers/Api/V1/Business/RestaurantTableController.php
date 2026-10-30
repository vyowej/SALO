<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\RestaurantTableRequest;
use App\Http\Resources\RestaurantTableResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\BusinessReservationService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class RestaurantTableController extends Controller
{
    public function index(Request $request, BusinessReservationService $service)
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageTables', $restaurant);

        return RestaurantTableResource::collection(collect($service->tables($restaurant)));
    }

    public function store(RestaurantTableRequest $request, BusinessReservationService $service): RestaurantTableResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageTables', $restaurant);

        return RestaurantTableResource::make($service->createTable(
            $restaurant,
            $this->user($request),
            $request->validated(),
        ));
    }

    public function update(
        RestaurantTableRequest $request,
        string $table,
        BusinessReservationService $service,
    ): RestaurantTableResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageTables', $restaurant);
        abort_unless(ctype_digit($table), 404);

        return RestaurantTableResource::make($service->updateTable(
            $restaurant,
            $this->user($request),
            (int) $table,
            $request->validated(),
        ));
    }

    public function destroy(Request $request, string $table, BusinessReservationService $service): Response
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageTables', $restaurant);
        abort_unless(ctype_digit($table), 404);
        $service->deleteTable($restaurant, $this->user($request), (int) $table);

        return response()->noContent();
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
