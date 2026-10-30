<?php

namespace App\Http\Middleware;

use App\Models\Restaurant;
use App\Policies\RestaurantAccessPolicy;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRestaurantMembership
{
    public function __construct(private readonly RestaurantAccessPolicy $policy) {}

    public function handle(Request $request, Closure $next, string $permission = 'restaurant.view'): Response
    {
        $user = $request->user();
        $restaurantId = $request->route('restaurant');

        abort_unless($user !== null, 401);
        abort_unless($user->active_mode === 'business', 403);
        abort_if(
            $request->header('X-SALO-Mode') !== null
                && $request->header('X-SALO-Mode') !== 'business',
            403,
        );
        abort_unless(is_string($restaurantId) || is_int($restaurantId), 404);

        /** @var Restaurant $restaurant */
        $restaurant = Restaurant::query()->findOrFail($restaurantId);
        abort_unless((string) $user->selected_restaurant_id === (string) $restaurant->getKey(), 403);
        abort_if(
            $request->header('X-SALO-Restaurant') !== null
                && (string) $request->header('X-SALO-Restaurant') !== (string) $restaurant->getKey(),
            403,
        );

        $membership = $policy->membership($user, $restaurant);
        if ($membership === null) {
            $knownMembership = $user->restaurantStaff()
                ->where('restaurant_id', $restaurant->getKey())
                ->whereIn('status', ['invited', 'suspended', 'removed'])
                ->exists();
            abort_if($knownMembership, 403);
            abort(404);
        }
        abort_unless($policy->allows($user, $restaurant, $permission), 403);
        abort_if(! $policy->mayWrite($restaurant) && ! $request->isMethod('GET') && ! $request->isMethod('HEAD'), 403);

        $request->attributes->set('restaurant', $restaurant);
        $request->attributes->set('restaurant_membership', $membership);

        return $next($request);
    }
}
