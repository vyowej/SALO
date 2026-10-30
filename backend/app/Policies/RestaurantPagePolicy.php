<?php

namespace App\Policies;

use App\Models\Restaurant;
use App\Models\User;

class RestaurantPagePolicy
{
    public function __construct(private readonly RestaurantAccessPolicy $access) {}

    public function view(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.view');
    }

    public function edit(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.page.edit');
    }

    public function editSensitive(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.sensitive.edit');
    }

    public function publish(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.publish');
    }

    public function managePhotos(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.photos.manage');
    }

    public function manageHours(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.hours.manage');
    }
}
