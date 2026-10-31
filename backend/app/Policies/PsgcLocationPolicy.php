<?php

namespace App\Policies;

use App\Models\User;

class PsgcLocationPolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }
}
