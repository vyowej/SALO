<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\AddressRequest;
use App\Http\Requests\Customer\SetPrimaryAddressRequest;
use App\Http\Resources\AddressResource;
use App\Repositories\Contracts\AddressRepository;
use App\Services\AddressService;
use App\Models\UserAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;

class AddressController extends Controller
{
    public function index(Request $request, AddressService $addresses): AnonymousResourceCollection
    {
        $this->authorize('viewAny', UserAddress::class);

        return AddressResource::collection($addresses->list((string) $request->user()->getAuthIdentifier()));
    }

    public function store(AddressRequest $request, AddressService $addresses): JsonResponse
    {
        $this->authorize('create', UserAddress::class);
        $address = $addresses->create(
            (string) $request->user()->getAuthIdentifier(),
            $request->validated(),
        );

        return AddressResource::make($address)->response()->setStatusCode(201);
    }

    public function update(AddressRequest $request, AddressService $addresses, string $address): AddressResource
    {
        $userId = (string) $request->user()->getAuthIdentifier();
        abort_if(app(AddressRepository::class)->findForUser($userId, $address) === null, 404);
        $this->authorize('update', [UserAddress::class, $address]);
        $updated = $addresses->update($userId, $address, $request->validated());

        abort_if($updated === null, 404);

        return AddressResource::make($updated);
    }

    public function destroy(Request $request, AddressService $addresses, string $address): JsonResponse
    {
        $userId = (string) $request->user()->getAuthIdentifier();
        abort_if(app(AddressRepository::class)->findForUser($userId, $address) === null, 404);
        $this->authorize('delete', [UserAddress::class, $address]);
        $deleted = $addresses->delete($userId, $address);
        abort_unless($deleted, 404);

        return JsonResource::make(['deleted' => true])->response();
    }

    public function setPrimary(SetPrimaryAddressRequest $request, AddressService $addresses, string $address): AddressResource
    {
        $userId = (string) $request->user()->getAuthIdentifier();
        abort_if(app(AddressRepository::class)->findForUser($userId, $address) === null, 404);
        $this->authorize('setPrimary', [UserAddress::class, $address]);
        $primary = $addresses->setPrimary($userId, $address);
        abort_if($primary === null, 404);

        return AddressResource::make($primary);
    }
}
