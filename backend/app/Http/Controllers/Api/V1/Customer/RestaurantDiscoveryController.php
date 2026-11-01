<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\RestaurantIndexRequest;
use App\Http\Requests\Customer\RestaurantMenuRequest;
use App\Http\Requests\Customer\RestaurantPopularRequest;
use App\Http\Requests\Customer\RestaurantReviewIndexRequest;
use App\Http\Resources\CustomerRestaurantResource;
use App\Http\Resources\CustomerRestaurantReviewResource;
use App\Http\Resources\MenuResource;
use App\Models\Restaurant;
use App\Services\RestaurantDiscoveryService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class RestaurantDiscoveryController extends Controller
{
    public function index(RestaurantIndexRequest $request, RestaurantDiscoveryService $service)
    {
        $this->authorize('viewAnyCustomer', Restaurant::class);

        return CustomerRestaurantResource::collection(
            $service->list($request->validated()),
        );
    }

    public function popular(RestaurantPopularRequest $request, RestaurantDiscoveryService $service)
    {
        Gate::authorize('viewPopular', Restaurant::class);
        $filters = $request->validated();

        return CustomerRestaurantResource::collection($service->popular(
            (int) ($filters['limit'] ?? 6),
            $filters,
        ));
    }

    public function categories(RestaurantDiscoveryService $service): JsonResource
    {
        $this->authorize('viewAnyCustomer', Restaurant::class);

        return JsonResource::make(['categories' => $service->categories()->all()]);
    }

    public function home(RestaurantIndexRequest $request, RestaurantDiscoveryService $service): JsonResource
    {
        $this->authorize('viewAnyCustomer', Restaurant::class);
        $filters = array_merge($request->validated(), [
            'sort' => $request->validated('sort', 'popularity'),
            'per_page' => 8,
        ]);
        $restaurants = $service->list($filters);

        return JsonResource::make([
            'restaurants' => CustomerRestaurantResource::collection($restaurants)->resolve($request),
            'categories' => $service->categories()->all(),
            'meta' => [
                'current_page' => $restaurants->currentPage(),
                'last_page' => $restaurants->lastPage(),
                'per_page' => $restaurants->perPage(),
                'total' => $restaurants->total(),
            ],
        ]);
    }

    public function show(string $restaurant, RestaurantDiscoveryService $service): CustomerRestaurantResource
    {
        abort_unless(ctype_digit($restaurant), 404);
        $publicRestaurant = $service->findPublic((int) $restaurant);
        abort_unless($publicRestaurant !== null, 404);
        $this->authorize('viewCustomer', $publicRestaurant);

        return CustomerRestaurantResource::make($publicRestaurant);
    }

    public function menu(
        RestaurantMenuRequest $request,
        string $restaurant,
        RestaurantDiscoveryService $service,
    ): MenuResource {
        abort_unless(ctype_digit($restaurant), 404);
        $publicRestaurant = $service->findPublic((int) $restaurant);
        abort_unless($publicRestaurant !== null, 404);
        $this->authorize('viewCustomer', $publicRestaurant);

        return MenuResource::make($service->menu($publicRestaurant, $request->validated()));
    }

    public function reviews(
        RestaurantReviewIndexRequest $request,
        string $restaurant,
        RestaurantDiscoveryService $service,
    ): AnonymousResourceCollection {
        abort_unless(ctype_digit($restaurant), 404);
        $publicRestaurant = $service->findPublic((int) $restaurant);
        abort_unless($publicRestaurant !== null, 404);
        $this->authorize('viewCustomer', $publicRestaurant);

        return CustomerRestaurantReviewResource::collection(
            $service->reviews($publicRestaurant, $request->validated()),
        );
    }
}
