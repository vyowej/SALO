<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CartItemStoreRequest;
use App\Http\Requests\Customer\CartItemUpdateRequest;
use App\Http\Resources\CustomerCartResource;
use App\Models\Cart;
use App\Services\CustomerCartService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\JsonResponse;

class CustomerCartController extends Controller
{
    public function index(Request $request, CustomerCartService $carts): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Cart::class);

        return CustomerCartResource::collection(
            $carts->list((int) $request->user()->getAuthIdentifier()),
        );
    }

    public function storeItem(
        CartItemStoreRequest $request,
        CustomerCartService $carts,
        string $restaurant,
    ): CustomerCartResource {
        $this->authorize('update', Cart::class);

        return CustomerCartResource::make($carts->addItem(
            (int) $request->user()->getAuthIdentifier(),
            $restaurant,
            $request->validated(),
        ));
    }

    public function updateItem(
        CartItemUpdateRequest $request,
        CustomerCartService $carts,
        string $restaurant,
        string $item,
    ): CustomerCartResource {
        $this->authorize('update', Cart::class);

        return CustomerCartResource::make($carts->updateItem(
            (int) $request->user()->getAuthIdentifier(),
            $restaurant,
            $item,
            $request->validated(),
        ));
    }

    public function destroyItem(
        Request $request,
        CustomerCartService $carts,
        string $restaurant,
        string $item,
    ): CustomerCartResource {
        $this->authorize('update', Cart::class);

        return CustomerCartResource::make($carts->removeItem(
            (int) $request->user()->getAuthIdentifier(),
            $restaurant,
            $item,
        ));
    }

    public function destroy(Request $request, CustomerCartService $carts, string $restaurant): JsonResponse
    {
        $this->authorize('update', Cart::class);
        $carts->clear(
            (int) $request->user()->getAuthIdentifier(),
            $restaurant,
        );

        return response()->json(['data' => ['deleted' => true]]);
    }
}
