<?php

namespace App\Policies;

use App\Models\RestaurantApplication;
use App\Models\User;

class ApplicationDocumentPolicy
{
    public function view(User $user, RestaurantApplication $application): bool
    {
        if ($user->status !== 'active') {
            return false;
        }

        if ((int) $application->submitted_by === (int) $user->getKey()) {
            return true;
        }

        return in_array('admin', $user->capabilities, true)
            && $user->active_mode === 'admin';
    }

    public function update(User $user, RestaurantApplication $application): bool
    {
        return $user->status === 'active'
            && (int) $application->submitted_by === (int) $user->getKey()
            && in_array($application->status, ['draft', 'needs_revision'], true)
            && $application->application_type === 'initial';
    }
}
