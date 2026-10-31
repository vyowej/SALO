<?php

namespace App\Repositories\Database;

use App\Models\PsgcLocation;
use App\Models\UserAddress;
use App\Repositories\Contracts\AddressRepository;
use Illuminate\Support\Facades\DB;

class DatabaseAddressRepository implements AddressRepository
{
    public function allForUser(string $userId): array
    {
        return UserAddress::query()
            ->where('user_id', $userId)
            ->with('location.parent.parent.parent')
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get()
            ->map(fn (UserAddress $address): array => $this->toArray($address))
            ->all();
    }

    public function findForUser(string $userId, string $addressId): ?array
    {
        $address = UserAddress::query()
            ->where('user_id', $userId)
            ->whereKey($addressId)
            ->with('location.parent.parent.parent')
            ->first();

        return $address === null ? null : $this->toArray($address);
    }

    public function create(string $userId, array $attributes): array
    {
        $address = DB::transaction(function () use ($userId, $attributes): UserAddress {
            $this->lockUser($userId);
            $isDefault = (bool) ($attributes['is_default'] ?? false)
                || ! UserAddress::query()->where('user_id', $userId)->exists();

            if ($isDefault) {
                UserAddress::query()->where('user_id', $userId)->update(['is_default' => false]);
            }

            return UserAddress::query()->create($this->attributesFor($userId, $attributes, $isDefault));
        });

        return $this->findForUser($userId, (string) $address->getKey());
    }

    public function update(string $userId, string $addressId, array $attributes): ?array
    {
        $updated = DB::transaction(function () use ($userId, $addressId, $attributes): ?UserAddress {
            $this->lockUser($userId);
            $address = UserAddress::query()
                ->where('user_id', $userId)
                ->whereKey($addressId)
                ->lockForUpdate()
                ->first();

            if ($address === null) {
                return null;
            }

            $wantsDefault = (bool) ($attributes['is_default'] ?? false);
            if ($wantsDefault) {
                UserAddress::query()
                    ->where('user_id', $userId)
                    ->whereKeyNot($addressId)
                    ->update(['is_default' => false]);
            }

            $wasDefault = (bool) $address->is_default;
            $address->fill($this->attributesFor($userId, $attributes));
            $address->save();

            if ($wasDefault && array_key_exists('is_default', $attributes) && ! $wantsDefault) {
                $next = UserAddress::query()
                    ->where('user_id', $userId)
                    ->whereKeyNot($addressId)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();

                if ($next !== null) {
                    $next->forceFill(['is_default' => true])->save();
                }
            }

            return $address;
        });

        return $updated === null ? null : $this->findForUser($userId, (string) $updated->getKey());
    }

    public function delete(string $userId, string $addressId): bool
    {
        return DB::transaction(function () use ($userId, $addressId): bool {
            $this->lockUser($userId);
            $address = UserAddress::query()
                ->where('user_id', $userId)
                ->whereKey($addressId)
                ->lockForUpdate()
                ->first();

            if ($address === null) {
                return false;
            }

            $wasDefault = $address->is_default;
            $address->delete();

            if ($wasDefault) {
                $next = UserAddress::query()
                    ->where('user_id', $userId)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();

                if ($next !== null) {
                    $next->forceFill(['is_default' => true])->save();
                }
            }

            return true;
        });
    }

    public function setPrimary(string $userId, string $addressId): ?array
    {
        $updated = DB::transaction(function () use ($userId, $addressId): ?UserAddress {
            $this->lockUser($userId);
            $address = UserAddress::query()
                ->where('user_id', $userId)
                ->whereKey($addressId)
                ->lockForUpdate()
                ->first();

            if ($address === null) {
                return null;
            }

            UserAddress::query()
                ->where('user_id', $userId)
                ->whereKeyNot($addressId)
                ->update(['is_default' => false]);
            $address->forceFill(['is_default' => true])->save();

            return $address;
        });

        return $updated === null ? null : $this->findForUser($userId, (string) $updated->getKey());
    }

    private function lockUser(string $userId): void
    {
        DB::table('users')->where('id', $userId)->lockForUpdate()->first();
    }

    private function attributesFor(string $userId, array $attributes, ?bool $isDefault = null): array
    {
        $values = array_intersect_key($attributes, array_flip([
            'psgc_code',
            'label',
            'address_type',
            'custom_label',
            'street',
            'house_no',
            'latitude',
            'longitude',
            'delivery_note',
        ]));
        $values['user_id'] = $userId;

        if ($isDefault !== null) {
            $values['is_default'] = $isDefault;
        } elseif (array_key_exists('is_default', $attributes)) {
            $values['is_default'] = (bool) $attributes['is_default'];
        }

        return $values;
    }

    private function toArray(UserAddress $address): array
    {
        $levels = [];
        $location = $address->location;

        while ($location !== null) {
            $levels[$location->level] = $location->name;
            $location = $location->parent;
        }

        return [
            'id' => (string) $address->getKey(),
            'user_id' => (string) $address->user_id,
            'psgc_code' => $address->psgc_code,
            'psgc_full_name' => $address->location?->full_name,
            'label' => $address->label,
            'address_type' => $address->address_type,
            'custom_label' => $address->custom_label,
            'region' => $levels['region'] ?? '',
            'province' => $levels['province'] ?? '',
            'city_municipality' => $levels['city'] ?? '',
            'barangay' => $levels['barangay'] ?? '',
            'street' => $address->street ?? '',
            'house_no' => $address->house_no ?? '',
            'latitude' => $address->latitude,
            'longitude' => $address->longitude,
            'is_default' => (bool) $address->is_default,
            'is_main' => (bool) $address->is_default,
            'delivery_note' => $address->delivery_note ?? '',
            'rider_note' => $address->delivery_note ?? '',
        ];
    }
}
