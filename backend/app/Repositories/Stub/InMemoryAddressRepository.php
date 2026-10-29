<?php

namespace App\Repositories\Stub;

use App\Repositories\Contracts\AddressRepository;
use Illuminate\Support\Str;

class InMemoryAddressRepository implements AddressRepository
{
    private array $addresses = [];

    public function allForUser(string $userId): array
    {
        // DB-INTEGRATION: replace session-scoped address state with the approved address repository.
        return $this->addressesFor($userId);
    }

    public function findForUser(string $userId, string $addressId): ?array
    {
        foreach ($this->addressesFor($userId) as $address) {
            if ($address['id'] === $addressId) {
                return $address;
            }
        }

        return null;
    }

    public function create(string $userId, array $attributes): array
    {
        // DB-INTEGRATION: enforce address ownership and primary-address uniqueness in the approved store.
        $addresses = $this->addressesFor($userId);
        $address = array_merge($attributes, [
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'is_main' => $attributes['is_main'] ?? $addresses === [],
        ]);

        if ($address['is_main']) {
            $addresses = array_map(fn (array $entry) => array_merge($entry, ['is_main' => false]), $addresses);
        }

        array_unshift($addresses, $address);
        $this->saveAddresses($userId, $addresses);

        return $address;
    }

    public function update(string $userId, string $addressId, array $attributes): ?array
    {
        // DB-INTEGRATION: update only a record owned by the account and preserve repository invariants.
        $addresses = $this->addressesFor($userId);
        $found = false;

        foreach ($addresses as &$address) {
            if ($address['id'] !== $addressId) {
                continue;
            }

            $address = array_merge($address, $attributes);
            $found = true;
        }
        unset($address);

        if (! $found) {
            return null;
        }

        $this->saveAddresses($userId, $addresses);

        return $this->findForUser($userId, $addressId);
    }

    public function delete(string $userId, string $addressId): bool
    {
        // DB-INTEGRATION: enforce ownership and retain the one-primary-address invariant when applicable.
        $addresses = $this->addressesFor($userId);
        $remaining = array_values(array_filter(
            $addresses,
            fn (array $address) => $address['id'] !== $addressId,
        ));

        if (count($remaining) === count($addresses)) {
            return false;
        }

        if ($remaining !== [] && ! collect($remaining)->contains(fn (array $address) => $address['is_main'])) {
            $remaining[0]['is_main'] = true;
        }

        $this->saveAddresses($userId, $remaining);

        return true;
    }

    public function setPrimary(string $userId, string $addressId): ?array
    {
        // DB-INTEGRATION: make the primary-address update atomic for an account.
        $addresses = $this->addressesFor($userId);
        $found = false;

        foreach ($addresses as &$address) {
            $address['is_main'] = $address['id'] === $addressId;
            $found = $found || $address['is_main'];
        }
        unset($address);

        if (! $found) {
            return null;
        }

        $this->saveAddresses($userId, $addresses);

        return $this->findForUser($userId, $addressId);
    }

    public function reset(): void
    {
        $this->addresses = [];
    }

    private function addressesFor(string $userId): array
    {
        $request = app('request');
        if ($request->hasSession()) {
            return $request->session()->get('salo.addresses.'.$userId, []);
        }

        return $this->addresses[$userId] ?? [];
    }

    private function saveAddresses(string $userId, array $addresses): void
    {
        $this->addresses[$userId] = $addresses;

        $request = app('request');
        if ($request->hasSession()) {
            $request->session()->put('salo.addresses.'.$userId, $addresses);
        }
    }
}
