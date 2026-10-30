<?php

namespace App\Policies;

use App\Http\Authorization\PermissionMap;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class RestaurantAccessPolicy
{
    public function membership(User $user, Restaurant $restaurant): ?array
    {
        return $user->restaurantMembership($restaurant);
    }

    public function allows(User $user, Restaurant $restaurant, string $permission): bool
    {
        $membership = $this->membership($user, $restaurant);

        return $membership !== null
            && PermissionMap::allows($membership['role'], $permission);
    }

    public function mayWrite(Restaurant $restaurant): bool
    {
        return $restaurant->status !== 'suspended';
    }

    public function contains(Restaurant $restaurant, Model $resource): bool
    {
        if (array_key_exists('restaurant_id', $resource->getAttributes())) {
            return (string) $resource->getAttribute('restaurant_id') === (string) $restaurant->getKey();
        }

        if (method_exists($resource, 'restaurant')) {
            return (string) $resource->restaurant?->getKey() === (string) $restaurant->getKey();
        }

        if (method_exists($resource, 'category')) {
            return (string) $resource->category?->restaurant_id === (string) $restaurant->getKey();
        }

        return false;
    }
}
