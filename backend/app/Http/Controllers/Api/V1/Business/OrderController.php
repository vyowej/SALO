<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\OrderListRequest;
use App\Http\Requests\Business\OrderStatusRequest;
use App\Http\Resources\OrderResource;
use App\Models\Restaurant;
use App\Models\User;
use App\Services\BusinessOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class OrderController extends Controller
{
    public function index(OrderListRequest $request, BusinessOrderService $service): JsonResponse
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('viewOrders', $restaurant);
        $result = $service->list($restaurant, $request->validated(), $this->canViewActors($request, $restaurant));

        return response()->json([
            'data' => OrderResource::collection(collect($result['data']))->resolve(),
            'meta' => $result['meta'],
        ]);
    }

    public function show(Request $request, string $order, BusinessOrderService $service): OrderResource
    {
        $restaurant = $this->restaurant($request);
        $this->authorize('viewOrders', $restaurant);
        abort_unless(ctype_digit($order), 404);

        return OrderResource::make($service->show(
            $restaurant,
            (int) $order,
            $this->canViewActors($request, $restaurant),
        ));
    }

    public function updateStatus(
        OrderStatusRequest $request,
        string $order,
        BusinessOrderService $service,
    ): OrderResource {
        $restaurant = $this->restaurant($request);
        $this->authorize('updateOrderStatus', $restaurant);
        abort_unless(ctype_digit($order), 404);
        $data = $request->validated();
        if (in_array($data['status'], ['rejected', 'cancelled'], true)) {
            $this->authorize('cancelOrder', $restaurant);
        }

        return OrderResource::make($service->transition(
            $restaurant,
            $this->user($request),
            (int) $order,
            $data['status'],
            $data['reason'] ?? null,
            $this->canViewActors($request, $restaurant),
        ));
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

    private function canViewActors(Request $request, Restaurant $restaurant): bool
    {
        return $request->user() !== null
            && Gate::forUser($request->user())->allows('viewOrderActors', $restaurant);
    }
}
