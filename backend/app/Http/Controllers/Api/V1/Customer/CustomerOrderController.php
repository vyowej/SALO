<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CustomerOrderCancelRequest;
use App\Http\Requests\Customer\CustomerOrderIndexRequest;
use App\Http\Requests\Customer\CustomerReceiptConfirmationRequest;
use App\Http\Requests\Customer\CustomerRestaurantReviewRequest;
use App\Http\Resources\CustomerOrderResource;
use App\Models\Order;
use App\Services\CustomerOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerOrderController extends Controller
{
    public function index(
        CustomerOrderIndexRequest $request,
        CustomerOrderService $orders,
    ): AnonymousResourceCollection {
        $this->authorize('viewAny', Order::class);

        return CustomerOrderResource::collection($orders->list(
            (int) $request->user()->getAuthIdentifier(),
            $request->validated(),
        ));
    }

    public function show(Request $request, CustomerOrderService $orders, string $order): CustomerOrderResource
    {
        $ownedOrder = $orders->find((int) $request->user()->getAuthIdentifier(), (int) $order);
        $this->authorize('view', $ownedOrder);

        return CustomerOrderResource::make($ownedOrder);
    }

    public function tracking(Request $request, CustomerOrderService $orders, string $order): JsonResponse
    {
        $userId = (int) $request->user()->getAuthIdentifier();
        $ownedOrder = $orders->find($userId, (int) $order);
        $this->authorize('view', $ownedOrder);

        return response()->json(['data' => $orders->tracking($userId, (int) $order)]);
    }

    public function cancel(
        CustomerOrderCancelRequest $request,
        CustomerOrderService $orders,
        string $order,
    ): CustomerOrderResource {
        $userId = (int) $request->user()->getAuthIdentifier();
        $ownedOrder = $orders->find($userId, (int) $order);
        $this->authorize('cancel', $ownedOrder);

        return CustomerOrderResource::make($orders->cancel(
            $userId,
            (int) $order,
            $request->validated('reason'),
        ));
    }

    public function confirmReceipt(
        CustomerReceiptConfirmationRequest $request,
        CustomerOrderService $orders,
        string $order,
    ): CustomerOrderResource {
        $userId = (int) $request->user()->getAuthIdentifier();
        $ownedOrder = $orders->find($userId, (int) $order);
        $this->authorize('confirmReceipt', $ownedOrder);

        return CustomerOrderResource::make($orders->confirmReceipt($userId, (int) $order));
    }

    public function reviewRestaurant(
        CustomerRestaurantReviewRequest $request,
        CustomerOrderService $orders,
        string $order,
    ): CustomerOrderResource {
        $userId = (int) $request->user()->getAuthIdentifier();
        $ownedOrder = $orders->find($userId, (int) $order);
        $this->authorize('reviewRestaurant', $ownedOrder);
        $data = $request->validated();

        return CustomerOrderResource::make($orders->reviewRestaurant(
            $userId,
            (int) $order,
            $data['rating'],
            $data['comment'] ?? null,
        ));
    }
}
