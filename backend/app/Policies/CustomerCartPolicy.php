<?php

namespace App\Policies;

use App\Models\User;

class CustomerCartPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === 'active'
            && in_array('customer', $user->capabilities, true);
    }

    public function update(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function quote(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function checkout(User $user): bool
    {
        return $this->viewAny($user) && $user->email_verified_at !== null;
    }
}
