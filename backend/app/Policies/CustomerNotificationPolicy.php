<?php

namespace App\Policies;

use App\Models\CustomerNotification;
use App\Models\User;

class CustomerNotificationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === 'active'
            && in_array('customer', $user->capabilities, true);
    }

    public function update(User $user, CustomerNotification $notification): bool
    {
        return $this->viewAny($user)
            && (int) $notification->user_id === (int) $user->getKey();
    }
}
