<?php

namespace App\Policies;

use App\Models\RiderProfile;
use App\Models\User;

class RiderProfilePolicy
{
    public function create(User $user): bool
    {
        return $user->status === 'active' && in_array('customer', $user->capabilities, true);
    }

    public function view(User $user, RiderProfile $profile): bool
    {
        return (int) $profile->user_id === (int) $user->getKey();
    }

    public function update(User $user, RiderProfile $profile): bool
    {
        return $this->view($user, $profile)
            && in_array($profile->application_status, ['draft', 'needs_revision'], true);
    }

    public function submit(User $user, RiderProfile $profile): bool
    {
        return $this->update($user, $profile);
    }

    public function activate(User $user, RiderProfile $profile): bool
    {
        return $this->view($user, $profile)
            && $profile->application_status === 'approved'
            && $profile->status === 'pending_activation';
    }

    public function review(User $user): bool
    {
        return $user->platformAdmin()->where('status', 'active')->exists();
    }

    public function manageScheduling(User $user): bool
    {
        return $this->review($user);
    }
}
