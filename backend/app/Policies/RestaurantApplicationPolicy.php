<?php

namespace App\Policies;

use App\Models\RestaurantApplication;
use App\Models\User;

class RestaurantApplicationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === 'active'
            && in_array('admin', $user->capabilities ?? [], true)
            && $user->active_mode === 'admin';
    }

    public function review(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->status === 'active' && $user->active_mode === 'customer';
    }

    public function view(User $user, RestaurantApplication $application): bool
    {
        return $user->status === 'active'
            && (int) $application->submitted_by === (int) $user->getKey();
    }

    public function update(User $user, RestaurantApplication $application): bool
    {
        return $this->view($user, $application)
            && $application->application_type === 'initial'
            && in_array($application->status, ['draft', 'needs_revision'], true);
    }

    public function submit(User $user, RestaurantApplication $application): bool
    {
        return $this->update($user, $application);
    }
}
