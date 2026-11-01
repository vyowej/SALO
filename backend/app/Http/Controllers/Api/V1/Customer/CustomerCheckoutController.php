<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CheckoutQuoteRequest;
use App\Http\Requests\Customer\CheckoutStoreRequest;
use App\Http\Requests\Customer\DiscountValidationRequest;
use App\Http\Resources\CheckoutGroupResource;
use App\Models\Cart;
use App\Services\CustomerCheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerCheckoutController extends Controller
{
    public function quote(CheckoutQuoteRequest $request, CustomerCheckoutService $checkout): JsonResource
    {
        $this->authorize('quote', Cart::class);

        return JsonResource::make($checkout->quote(
            (int) $request->user()->getAuthIdentifier(),
            $request->validated('orders'),
        ));
    }

    public function validateDiscount(
        DiscountValidationRequest $request,
        CustomerCheckoutService $checkout,
    ): JsonResource {
        $this->authorize('quote', Cart::class);

        return JsonResource::make($checkout->validateDiscount(
            (int) $request->user()->getAuthIdentifier(),
            $request->validated(),
        ));
    }

    public function store(CheckoutStoreRequest $request, CustomerCheckoutService $checkout): JsonResponse
    {
        $this->authorize('checkout', Cart::class);
        $group = $checkout->place(
            (int) $request->user()->getAuthIdentifier(),
            $request->validated('orders'),
            $request->idempotencyKey(),
        );

        return CheckoutGroupResource::make($group)->response()->setStatusCode(201);
    }
}
