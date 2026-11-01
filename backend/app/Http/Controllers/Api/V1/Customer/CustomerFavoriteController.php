<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CustomerFavoriteIndexRequest;
use App\Http\Requests\Customer\CustomerFavoriteRequest;
use App\Http\Resources\CustomerFavoriteResource;
use App\Http\Resources\CustomerFavoriteStateResource;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Services\CustomerFavoriteService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerFavoriteController extends Controller
{
    public function index(
        CustomerFavoriteIndexRequest $request,
        CustomerFavoriteService $service,
    ): AnonymousResourceCollection {
        $this->authorize('viewAnyCustomer', Restaurant::class);

        return CustomerFavoriteResource::collection($service->list(
            (int) $request->user()->getKey(),
            $request->validated('type'),
        ));
    }

    public function favoriteRestaurant(
        CustomerFavoriteRequest $request,
        string $restaurant,
        CustomerFavoriteService $service,
    ): CustomerFavoriteStateResource {
        abort_unless(ctype_digit($restaurant), 404);
        $publicRestaurant = Restaurant::query()->findOrFail((int) $restaurant);
        $this->authorize('viewCustomer', $publicRestaurant);
        $service->favoriteRestaurant((int) $request->user()->getKey(), (int) $restaurant);

        return CustomerFavoriteStateResource::make(['favorited' => true]);
    }

    public function unfavoriteRestaurant(
        CustomerFavoriteRequest $request,
        string $restaurant,
        CustomerFavoriteService $service,
    ): CustomerFavoriteStateResource {
        $this->authorize('viewAnyCustomer', Restaurant::class);
        abort_unless(ctype_digit($restaurant), 404);
        $service->unfavoriteRestaurant((int) $request->user()->getKey(), (int) $restaurant);

        return CustomerFavoriteStateResource::make(['favorited' => false]);
    }

    public function favoriteMenuItem(
        CustomerFavoriteRequest $request,
        string $item,
        CustomerFavoriteService $service,
    ): CustomerFavoriteStateResource {
        abort_unless(ctype_digit($item), 404);
        $publicItem = MenuItem::query()
            ->with('category.restaurant')
            ->where('lifecycle_status', 'published')
            ->whereHas('category', fn ($categories) => $categories->where('status', 'active')
                ->whereHas('restaurant', fn ($restaurants) => $restaurants
                    ->where('status', 'approved')
                    ->where('is_published', true)))
            ->findOrFail((int) $item);
        $this->authorize('viewCustomer', $publicItem->category->restaurant);
        $service->favoriteMenuItem((int) $request->user()->getKey(), (int) $item);

        return CustomerFavoriteStateResource::make(['favorited' => true]);
    }

    public function unfavoriteMenuItem(
        CustomerFavoriteRequest $request,
        string $item,
        CustomerFavoriteService $service,
    ): CustomerFavoriteStateResource {
        $this->authorize('viewAnyCustomer', Restaurant::class);
        abort_unless(ctype_digit($item), 404);
        $service->unfavoriteMenuItem((int) $request->user()->getKey(), (int) $item);

        return CustomerFavoriteStateResource::make(['favorited' => false]);
    }
}
