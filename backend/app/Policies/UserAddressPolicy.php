<?php

namespace App\Policies;

use App\Models\User;
use App\Repositories\Contracts\AddressRepository;

class UserAddressPolicy
{
    public function __construct(private readonly AddressRepository $addresses) {}

    public function viewAny(User $user): bool
    {
        return in_array('customer', $user->capabilities, true);
    }

    public function create(User $user): bool
    {
        return in_array('customer', $user->capabilities, true);
    }

    public function update(User $user, string $addressId): bool
    {
        return $this->owns($user, $addressId);
    }

    public function delete(User $user, string $addressId): bool
    {
        return $this->owns($user, $addressId);
    }

    public function setPrimary(User $user, string $addressId): bool
    {
        return $this->owns($user, $addressId);
    }

    private function owns(User $user, string $addressId): bool
    {
        return $this->addresses->findForUser((string) $user->getAuthIdentifier(), $addressId) !== null;
    }
}
