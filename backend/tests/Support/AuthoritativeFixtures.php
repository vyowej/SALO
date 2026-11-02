<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Models\PsgcLocation;
use App\Models\Restaurant;
use App\Models\User;

trait AuthoritativeFixtures
{
    protected function createAuthoritativeBarangayLocation(): PsgcLocation
    {
        $suffix = str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
        $regionCode = '01'.$suffix;
        $provinceCode = '02'.$suffix;
        $cityCode = '03'.$suffix;
        $barangayCode = '04'.$suffix;

        PsgcLocation::query()->create([
            'code' => $regionCode,
            'name' => 'Fixture Region',
            'level' => 'region',
            'full_name' => 'Fixture Region',
        ]);
        PsgcLocation::query()->create([
            'code' => $provinceCode,
            'parent_code' => $regionCode,
            'name' => 'Fixture Province',
            'level' => 'province',
            'full_name' => 'Fixture Province, Fixture Region',
        ]);
        PsgcLocation::query()->create([
            'code' => $cityCode,
            'parent_code' => $provinceCode,
            'name' => 'Fixture City',
            'level' => 'city',
            'full_name' => 'Fixture City, Fixture Province, Fixture Region',
        ]);

        return PsgcLocation::query()->create([
            'code' => $barangayCode,
            'parent_code' => $cityCode,
            'name' => 'Fixture Barangay',
            'level' => 'barangay',
            'full_name' => 'Fixture Barangay, Fixture City, Fixture Province, Fixture Region',
        ]);
    }

    protected function createAuthoritativeRestaurant(User $owner, array $attributes = []): Restaurant
    {
        $barangay = $this->createAuthoritativeBarangayLocation();

        return Restaurant::query()->create(array_replace([
            'owner_user_id' => $owner->getKey(),
            'name' => 'Fixture Restaurant',
            'country_code' => 'PH',
            'psgc_code' => $barangay->getKey(),
            'street' => 'Fixture Street',
            'formatted_address' => 'Fixture Street, Fixture Barangay, Fixture City, Fixture Province, Fixture Region, Philippines',
            'status' => 'approved',
            'is_24_7' => true,
        ], $attributes));
    }
}
