<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class CustomerOrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === 'active'
            && in_array('customer', $user->capabilities, true);
    }

    public function view(User $user, Order $order): bool
    {
        return $this->viewAny($user)
            && (int) $order->checkoutGroup?->user_id === (int) $user->getKey();
    }

    public function cancel(User $user, Order $order): bool
    {
        return $this->view($user, $order);
    }

    public function confirmReceipt(User $user, Order $order): bool
    {
        return $this->view($user, $order);
    }

    public function reviewRestaurant(User $user, Order $order): bool
    {
        return $this->view($user, $order);
    }
}
