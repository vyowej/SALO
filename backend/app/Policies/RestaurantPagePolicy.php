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

    public function manageMenu(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.menu.manage');
    }

    public function manageMenuAvailability(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'menu.availability.manage');
    }

    public function viewOrders(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'orders.view');
    }

    public function updateOrderStatus(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'orders.status.update');
    }

    public function cancelOrder(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'orders.cancel');
    }

    public function viewOrderActors(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'audit.view');
    }

    public function viewReservations(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'reservations.view');
    }

    public function manageReservations(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'reservations.manage');
    }

    public function manageTables(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'tables.manage');
    }

    public function manageDiscounts(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'discounts.manage');
    }

    public function viewCalendar(User $user, Restaurant $restaurant): bool
    {
        return $this->access->allows($user, $restaurant, 'restaurant.view')
            || $this->access->allows($user, $restaurant, 'reservations.view');
    }

    public function viewReport(User $user, Restaurant $restaurant, string $report): bool
    {
        $permission = in_array($report, ['reservations', 'no_show_rate'], true)
            ? 'reports.reservations.view'
            : 'reports.sales_reservations.view';

        return $this->access->allows($user, $restaurant, $permission);
    }
}
