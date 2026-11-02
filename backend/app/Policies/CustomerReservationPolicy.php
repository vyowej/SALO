<?php

namespace App\Policies;

use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\User;

class CustomerReservationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === 'active'
            && in_array('customer', $user->capabilities, true);
    }

    public function view(User $user, Reservation $reservation): bool
    {
        return $this->viewAny($user)
            && (int) $reservation->user_id === (int) $user->getKey();
    }

    public function create(User $user, Restaurant $restaurant): bool
    {
        return $this->viewAny($user)
            && $user->email_verified_at !== null
            && $restaurant->status === 'approved'
            && (bool) $restaurant->is_published;
    }

    public function cancel(User $user, Reservation $reservation): bool
    {
        return $this->view($user, $reservation);
    }
}
