<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\BusinessDiscountListRequest;
use App\Http\Requests\Business\BusinessDiscountRequest;
use App\Http\Resources\BusinessDiscountResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\BusinessDiscountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BusinessDiscountController extends Controller
{
    public function index(BusinessDiscountListRequest $request, BusinessDiscountService $service): JsonResponse
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageDiscounts', $restaurant);
        $result = $service->list($restaurant, $request->validated());

        return response()->json([
            'data' => BusinessDiscountResource::collection(collect($result['data']))->resolve(),
            'meta' => $result['meta'],
        ]);
    }

    public function store(
        BusinessDiscountRequest $request,
        BusinessDiscountService $service,
    ): BusinessDiscountResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageDiscounts', $restaurant);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return BusinessDiscountResource::make($service->create($restaurant, $actor, $request->validated()));
    }

    public function update(
        BusinessDiscountRequest $request,
        string $discount,
        BusinessDiscountService $service,
    ): BusinessDiscountResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageDiscounts', $restaurant);
        abort_unless(ctype_digit($discount), 404);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return BusinessDiscountResource::make($service->update(
            $restaurant,
            $actor,
            (int) $discount,
            $request->validated(),
        ));
    }

    public function destroy(Request $request, string $discount, BusinessDiscountService $service): Response
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('manageDiscounts', $restaurant);
        abort_unless(ctype_digit($discount), 404);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);
        $service->deactivate($restaurant, $actor, (int) $discount);

        return response()->noContent();
    }

    private function restaurant(Request $request): Restaurant
    {
        $restaurant = $request->attributes->get('restaurant');
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }
}
