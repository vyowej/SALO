<?php

namespace Tests\Support;

use App\Models\CheckoutGroup;
use App\Models\Order;
use App\Models\Payment;
use App\Models\RiderProfile;
use App\Models\RiderShiftAssignment;
use App\Models\Restaurant;
use App\Models\Shift;
use App\Models\User;
use App\Models\UserAddress;
use App\Models\Zone;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

trait RiderDispatchFixtures
{
    protected array $dispatchLocationKeys = [];

    protected function dispatchRestaurant(User $owner, string $psgcCode): Restaurant
    {
        return Restaurant::query()->create([
            'owner_user_id' => $owner->getKey(),
            'name' => 'Dispatch restaurant '.Str::random(10),
            'country_code' => 'PH',
            'psgc_code' => $psgcCode,
            'street' => 'Dispatch Street',
            'formatted_address' => 'Dispatch Street, Fixture Barangay, Fixture City',
            'latitude' => '14.600000',
            'longitude' => '121.000000',
            'status' => 'approved',
            'is_published' => true,
            'is_24_7' => true,
        ]);
    }

    protected function dispatchShift(): Shift
    {
        return Shift::query()->create([
            'name' => 'Dispatch shift '.Str::random(10),
            'start_time' => '00:01:00',
            'end_time' => '23:59:00',
        ]);
    }

    protected function dispatchZone(string $psgcCode, string $name, float $latitude = 14.6, float $longitude = 121.0): Zone
    {
        return Zone::query()->create([
            'psgc_code' => $psgcCode,
            'name' => $name.' '.Str::random(8),
            'center_lat' => $latitude,
            'center_lng' => $longitude,
            'radius_km' => 5,
            'is_active' => true,
        ]);
    }

    protected function dispatchRider(string $email, Shift $shift, Zone $zone): array
    {
        $user = RiderApplicationFixtures::user($email);
        $barangay = RiderApplicationFixtures::barangay();
        $profile = RiderProfile::query()->create([
            'user_id' => $user->getKey(),
            'application_status' => 'approved',
            'status' => 'active',
            'availability' => 'offline',
            'vehicle_type' => 'bicycle',
            'psgc_code' => $barangay->getKey(),
            'street' => 'Rider Dispatch Street',
            'formatted_address' => $barangay->full_name.', Rider Dispatch Street',
            'home_lat' => '14.600000',
            'home_lng' => '121.000000',
            'approved_at' => now(),
        ]);
        RiderShiftAssignment::query()->create([
            'rider_id' => $profile->getKey(),
            'zone_id' => $zone->getKey(),
            'shift_id' => $shift->getKey(),
            'status' => 'assigned',
            'assigned_by' => 'system',
        ]);

        return ['user' => $user, 'profile' => $profile];
    }

    protected function dispatchOrder(User $customer, Restaurant $restaurant): Order
    {
        $address = UserAddress::query()->create([
            'user_id' => $customer->getKey(),
            'country_code' => 'PH',
            'psgc_code' => $restaurant->psgc_code,
            'label' => 'Home',
            'address_type' => 'home',
            'street' => '99 Private Customer Street',
            'formatted_address' => '99 Private Customer Street, Exact Barangay, Exact City',
            'latitude' => '14.610000',
            'longitude' => '121.010000',
        ]);
        $group = CheckoutGroup::query()->create([
            'user_id' => $customer->getKey(),
            'reference_code' => 'G'.Str::upper(Str::random(11)),
            'idempotency_key' => 'dispatch-'.Str::random(24),
            'placed_at' => now(),
        ]);
        $order = Order::query()->create([
            'checkout_id' => $group->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'delivery_address_id' => $address->getKey(),
            'reference_code' => 'O'.Str::upper(Str::random(11)),
            'order_type' => 'delivery',
            'status' => 'ready',
            'recipient_name' => 'Private Customer Name',
            'recipient_phone' => '+639171234567',
            'delivery_address_text' => '99 Private Customer Street, Exact Barangay',
            'delivery_country_code' => 'PH',
            'delivery_lat' => '14.610000',
            'delivery_lng' => '121.010000',
            'subtotal' => '200.00',
            'delivery_fee' => '35.00',
            'service_fee' => '0.00',
            'discount_amount' => '0.00',
            'total_amount' => '235.00',
            'placed_at' => now(),
        ]);
        Payment::query()->create([
            'order_id' => $order->getKey(),
            'method' => 'cod',
            'status' => 'unpaid',
            'amount' => '235.00',
        ]);

        return $order;
    }

    protected function cacheDispatchLocation(RiderProfile $profile, float $latitude = 14.6, float $longitude = 121.0): void
    {
        $key = "rider:{$profile->getKey()}:dispatch-location";
        $this->dispatchLocationKeys[] = $key;
        Cache::put($key, [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'updated_at' => now()->toIso8601String(),
        ], now()->addMinutes(2));
        $profile->forceFill(['availability' => 'online'])->save();
    }

    protected function clearDispatchLocations(): void
    {
        foreach (array_unique($this->dispatchLocationKeys) as $key) {
            Cache::forget($key);
        }
    }
}
