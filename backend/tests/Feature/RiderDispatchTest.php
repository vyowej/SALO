<?php

namespace Tests\Feature;

use App\Models\CustomerNotification;
use App\Models\Delivery;
use App\Models\DeliveryOffer;
use App\Models\PlatformSetting;
use App\Models\RiderProfile;
use App\Models\User;
use App\Services\RiderDispatchService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;
use Tests\Support\RiderApplicationFixtures;
use Tests\Support\RiderDispatchFixtures;
use Tests\TestCase;

class RiderDispatchTest extends TestCase
{
    use RiderDispatchFixtures;

    private array $concurrencyFixture = [];

    private array $concurrencyTempFiles = [];

    protected function tearDown(): void
    {
        $this->clearDispatchLocations();
        $this->cleanupConcurrencyFixture();
        foreach ($this->concurrencyTempFiles as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }
        parent::tearDown();
    }

    public function test_online_rider_receives_ready_cod_offer_without_customer_details_until_acceptance(): void
    {
        [$order, $rider, $zone] = $this->dispatchScenario();
        $service = app(RiderDispatchService::class);

        $service->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
        $delivery = Delivery::query()->where('order_id', $order->getKey())->firstOrFail();
        $offer = DeliveryOffer::query()->where('delivery_id', $delivery->getKey())->firstOrFail();

        $this->assertSame('offered', $delivery->status);
        $this->assertSame((int) $rider['profile']->getKey(), (int) $delivery->rider_id);
        $this->assertNull($offer->response);
        $preAccept = $service->currentFor($rider['user']);
        $this->assertSame('offer', $preAccept['type']);
        $this->assertArrayNotHasKey('customer', $preAccept['offer']);
        $this->assertArrayNotHasKey('address', $preAccept['offer']);
        $this->assertArrayNotHasKey('phone', $preAccept['offer']);
        $this->assertSame('Test City', $preAccept['offer']['dropoff_area']);

        $result = $service->respondToOffer($rider['user'], (int) $offer->getKey(), true);
        $this->assertSame('accepted', $result['status']);
        $postAccept = $service->currentFor($rider['user']);
        $this->assertSame('active_delivery', $postAccept['type']);
        $this->assertSame('Private Customer Name', $postAccept['delivery']['customer']['name']);
        $this->assertSame('+639171234567', $postAccept['delivery']['customer']['phone']);
        $this->assertSame('99 Private Customer Street, Exact Barangay', $postAccept['delivery']['customer']['address']);
        $this->assertSame('accepted', $delivery->fresh()->status);
        $this->assertSame('busy', $rider['profile']->fresh()->availability);

        $delivery->forceFill(['status' => 'delivered'])->save();
        $this->assertNull($service->currentFor($rider['user']));
    }

    public function test_rider_can_go_online_during_the_assigned_morning_shift_in_manila(): void
    {
        [, $rider] = $this->dispatchScenario();
        $shift = $rider['profile']->shiftAssignments()->firstOrFail()->shift;
        $shift->forceFill([
            'start_time' => '06:00:00',
            'end_time' => '12:00:00',
        ])->save();
        Carbon::setTestNow(Carbon::parse('2026-11-04 09:00:00', 'Asia/Manila'));

        try {
            $service = app(RiderDispatchService::class);
            $home = $service->home($rider['user']);

            $this->assertTrue($home['can_go_online']);
            $this->assertSame($shift->name, $home['assignment']['shift']);
            $this->assertSame('online', $service->setAvailability(
                $rider['user'],
                'online',
                14.6001,
                121.0001,
            )['availability']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_rider_cannot_go_online_outside_the_assigned_shift(): void
    {
        [, $rider] = $this->dispatchScenario();
        $shift = $rider['profile']->shiftAssignments()->firstOrFail()->shift;
        $shift->forceFill(['start_time' => '06:00:00', 'end_time' => '12:00:00'])->save();
        Carbon::setTestNow(Carbon::parse('2026-11-04 13:00:00', 'Asia/Manila'));

        try {
            $service = app(RiderDispatchService::class);
            $this->assertFalse($service->home($rider['user'])['can_go_online']);

            try {
                $service->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
                $this->fail('A rider outside the assigned shift should not be allowed online.');
            } catch (ValidationException $exception) {
                $this->assertSame(
                    ['You can go online only during an assigned shift.'],
                    $exception->errors()['availability'],
                );
            }
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_shift_start_is_inclusive_and_shift_end_is_exclusive(): void
    {
        [, $rider] = $this->dispatchScenario();
        $shift = $rider['profile']->shiftAssignments()->firstOrFail()->shift;
        $shift->forceFill(['start_time' => '06:00:00', 'end_time' => '12:00:00'])->save();
        $service = app(RiderDispatchService::class);

        try {
            Carbon::setTestNow(Carbon::parse('2026-11-04 06:00:00', 'Asia/Manila'));
            $this->assertTrue($service->home($rider['user'])['can_go_online']);
            $this->assertSame('online', $service->setAvailability(
                $rider['user'],
                'online',
                14.6001,
                121.0001,
            )['availability']);

            $service->setAvailability($rider['user'], 'offline', null, null);
            Carbon::setTestNow(Carbon::parse('2026-11-04 12:00:00', 'Asia/Manila'));
            $this->assertFalse($service->home($rider['user'])['can_go_online']);

            try {
                $service->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
                $this->fail('The shift end time should not be included in the shift window.');
            } catch (ValidationException $exception) {
                $this->assertSame(
                    ['You can go online only during an assigned shift.'],
                    $exception->errors()['availability'],
                );
            }
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_shift_eligibility_uses_manila_time_when_the_server_timezone_is_utc(): void
    {
        [, $rider] = $this->dispatchScenario();
        $shift = $rider['profile']->shiftAssignments()->firstOrFail()->shift;
        $shift->forceFill(['start_time' => '06:00:00', 'end_time' => '12:00:00'])->save();
        Carbon::setTestNow(Carbon::parse('2026-11-04 01:00:00', 'UTC'));

        try {
            $this->assertSame('UTC', config('app.timezone'));
            $this->assertSame('01:00:00', now()->format('H:i:s'));
            $this->assertSame('09:00:00', now('Asia/Manila')->format('H:i:s'));

            $service = app(RiderDispatchService::class);
            $this->assertTrue($service->home($rider['user'])['can_go_online']);
            $this->assertSame('online', $service->setAvailability(
                $rider['user'],
                'online',
                14.6001,
                121.0001,
            )['availability']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_nearest_eligible_rider_in_the_zone_receives_the_offer(): void
    {
        [$order, $nearestRider, $zone] = $this->dispatchScenario();
        $shift = $zone->assignments()->firstOrFail()->shift;
        $fartherRider = $this->dispatchRider('dispatch-farther-'.Str::random(10).'@example.test', $shift, $zone);
        $this->cacheDispatchLocation($nearestRider['profile'], 14.6001, 121.0001);
        $this->cacheDispatchLocation($fartherRider['profile'], 14.61, 121.01);

        app(RiderDispatchService::class)->dispatchReadyOrder((int) $order->getKey());

        $this->assertSame((int) $nearestRider['profile']->getKey(), (int) Delivery::query()
            ->where('order_id', $order->getKey())
            ->value('rider_id'));
    }

    public function test_declined_rider_is_not_reoffered_and_dispatch_widens_to_the_next_assigned_zone(): void
    {
        [$order, $firstRider, $primaryZone, $restaurantOwner, $customer] = $this->dispatchScenario();
        $shift = $primaryZone->assignments()->firstOrFail()->shift;
        $barangay = $restaurantOwner->ownedRestaurants()->firstOrFail()->psgc_code;
        $widerZone = $this->dispatchZone($barangay, 'Wider dispatch zone', 14.8, 121.2);
        $secondRider = $this->dispatchRider('dispatch-second-'.Str::random(10).'@example.test', $shift, $widerZone);
        $this->cacheDispatchLocation($secondRider['profile'], 14.6002, 121.0002);
        $service = app(RiderDispatchService::class);
        $service->setAvailability($firstRider['user'], 'online', 14.6001, 121.0001);
        $firstOffer = DeliveryOffer::query()->whereHas('delivery', fn ($query) => $query->where('order_id', $order->getKey()))->firstOrFail();

        $this->assertSame('declined', $service->respondToOffer($firstRider['user'], (int) $firstOffer->getKey(), false)['status']);

        $delivery = Delivery::query()->where('order_id', $order->getKey())->firstOrFail();
        $secondOffer = DeliveryOffer::query()
            ->where('delivery_id', $delivery->getKey())
            ->where('rider_id', $secondRider['profile']->getKey())
            ->firstOrFail();
        $this->assertSame('declined', $firstOffer->fresh()->response);
        $this->assertSame((int) $secondRider['profile']->getKey(), (int) $delivery->rider_id);
        $this->assertNull($secondOffer->response);
    }

    public function test_expired_offer_times_out_and_is_not_retried_to_the_same_rider(): void
    {
        [$order, $rider] = $this->dispatchScenario();
        $service = app(RiderDispatchService::class);
        $service->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
        $offer = DeliveryOffer::query()->firstOrFail();
        $offer->forceFill(['offered_at' => now()->subSeconds(61)])->save();
        PlatformSetting::query()->updateOrCreate(
            ['setting_key' => 'rider_ack_seconds'],
            ['value' => '60'],
        );

        $this->assertSame(1, $service->expireOffers());
        $this->assertSame('timeout', $offer->fresh()->response);
        $this->assertNull(Delivery::query()->where('order_id', $order->getKey())->value('rider_id'));
        $this->assertSame('online', $rider['profile']->fresh()->availability);
        $this->assertSame(1, DeliveryOffer::query()->where('delivery_id', $offer->delivery_id)->count());
    }

    public function test_unassigned_ready_order_notifies_customer_and_restaurant_once(): void
    {
        [$order, , , $owner, $customer] = $this->dispatchScenario(withRider: false);
        $admin = RiderApplicationFixtures::admin('dispatch-admin-'.Str::random(10).'@example.test');
        $service = app(RiderDispatchService::class);

        $service->dispatchReadyOrder((int) $order->getKey());
        $service->dispatchReadyOrder((int) $order->getKey());

        $this->assertSame(1, CustomerNotification::query()
            ->where('user_id', $customer->getKey())
            ->where('type', 'delivery_unassigned')
            ->where('related_reference', $order->reference_code)
            ->count());
        $this->assertSame(1, CustomerNotification::query()
            ->where('user_id', $owner->getKey())
            ->where('type', 'delivery_unassigned')
            ->where('related_reference', $order->reference_code)
            ->count());
        $this->assertSame(1, CustomerNotification::query()
            ->where('user_id', $admin->getKey())
            ->where('type', 'delivery_unassigned')
            ->where('related_reference', $order->reference_code)
            ->count());
        $this->assertSame('offered', Delivery::query()->where('order_id', $order->getKey())->value('status'));
    }

    public function test_rider_cannot_read_or_accept_another_riders_offer(): void
    {
        [$order, $rider, $zone] = $this->dispatchScenario();
        $shift = $zone->assignments()->firstOrFail()->shift;
        $otherRider = $this->dispatchRider('dispatch-other-'.Str::random(10).'@example.test', $shift, $zone);
        $service = app(RiderDispatchService::class);
        $service->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
        $offer = DeliveryOffer::query()->firstOrFail();

        $this->actingAs($otherRider['user'], 'sanctum')
            ->withSession(['salo.active_mode' => 'driver'])
            ->withHeaders([
                'Origin' => 'http://localhost:5173',
                'Referer' => 'http://localhost:5173',
                'X-SALO-Mode' => 'driver',
            ])
            ->getJson('/api/v1/driver/current-delivery')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->actingAs($otherRider['user'], 'sanctum')
            ->withSession(['salo.active_mode' => 'driver'])
            ->withHeaders([
                'Origin' => 'http://localhost:5173',
                'Referer' => 'http://localhost:5173',
                'X-SALO-Mode' => 'driver',
            ])
            ->postJson("/api/v1/driver/delivery-offers/{$offer->getKey()}/accept")
            ->assertNotFound();

        $this->assertSame('offered', Delivery::query()->where('order_id', $order->getKey())->value('status'));
    }

    public function test_switching_away_from_driver_mode_offlines_and_releases_a_pre_pickup_offer(): void
    {
        [$order, $rider] = $this->dispatchScenario();
        $service = app(RiderDispatchService::class);
        $service->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
        $offer = DeliveryOffer::query()->firstOrFail();

        $this->actingAs($rider['user'], 'sanctum')
            ->withSession(['salo.active_mode' => 'driver'])
            ->withHeaders([
                'Origin' => 'http://localhost:5173',
                'Referer' => 'http://localhost:5173',
                'X-SALO-Mode' => 'driver',
            ])
            ->postJson('/api/v1/auth/mode', ['mode' => 'customer'])
            ->assertOk();

        $this->assertSame('offline', $rider['profile']->fresh()->availability);
        $this->assertSame('timeout', $offer->fresh()->response);
        $this->assertNull(Delivery::query()->where('order_id', $order->getKey())->value('rider_id'));
        $this->assertFalse(Cache::has("rider:{$rider['profile']->getKey()}:dispatch-location"));
    }

    public function test_order_cancellation_cancels_the_delivery_and_releases_the_rider(): void
    {
        [$order, $rider] = $this->dispatchScenario();
        $service = app(RiderDispatchService::class);
        $service->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
        $offer = DeliveryOffer::query()->firstOrFail();

        $service->cancelForOrder((int) $order->getKey());

        $this->assertSame('cancelled', Delivery::query()->where('order_id', $order->getKey())->value('status'));
        $this->assertNull(Delivery::query()->where('order_id', $order->getKey())->value('rider_id'));
        $this->assertSame('timeout', $offer->fresh()->response);
        $this->assertSame('online', $rider['profile']->fresh()->availability);
    }

    public function test_active_rider_location_updates_are_cache_only_and_customer_sees_the_latest_point(): void
    {
        [$order, $rider, $delivery, , $customer] = $this->acceptedLocationScenario();
        $originalUpdatedAt = $delivery->fresh()->updated_at->toISOString();
        $uri = "/api/v1/driver/deliveries/{$delivery->getKey()}/location";

        $this->riderRequest($rider['user'], 'POST', $uri, [
            'latitude' => 14.6012,
            'longitude' => 121.0112,
        ])->assertOk()
            ->assertJsonStructure(['data' => ['recorded_at', 'expires_at']]);

        $this->riderRequest($rider['user'], 'POST', $uri, [
            'latitude' => 14.6023,
            'longitude' => 121.0123,
        ])->assertOk();

        $this->assertSame($originalUpdatedAt, $delivery->fresh()->updated_at->toISOString());
        $this->customerRequest($customer, 'GET', "/api/v1/customer/orders/{$order->getKey()}/tracking")
            ->assertOk()
            ->assertJsonPath('data.live_location.latitude', 14.6023)
            ->assertJsonPath('data.live_location.longitude', 121.0123)
            ->assertJsonPath('data.live_location_unavailable', false);
    }

    public function test_rider_location_update_rejects_another_rider_and_invalid_coordinates(): void
    {
        [, $rider, $delivery, , , $zone, $shift] = $this->acceptedLocationScenario();
        $otherRider = $this->dispatchRider('location-other-'.Str::random(10).'@example.test', $shift, $zone);
        $uri = "/api/v1/driver/deliveries/{$delivery->getKey()}/location";

        $this->riderRequest($otherRider['user'], 'POST', $uri, [
            'latitude' => 14.6,
            'longitude' => 121.0,
        ])->assertNotFound();

        $this->riderRequest($rider['user'], 'POST', $uri, [
            'latitude' => 91,
            'longitude' => 181,
        ])->assertUnprocessable()
            ->assertJsonPath('error.fields.latitude.0', 'The latitude field must be between -90 and 90.')
            ->assertJsonPath('error.fields.longitude.0', 'The longitude field must be between -180 and 180.');
    }

    public function test_customer_tracking_is_owned_active_and_clears_location_after_delivery_ends(): void
    {
        [$order, $rider, $delivery, , $customer] = $this->acceptedLocationScenario();
        $key = $this->deliveryLocationKey($delivery, $rider['profile']);
        $this->riderRequest($rider['user'], 'POST', "/api/v1/driver/deliveries/{$delivery->getKey()}/location", [
            'latitude' => 14.6012,
            'longitude' => 121.0112,
        ])->assertOk();
        $this->dispatchLocationKeys[] = $key;

        $otherCustomer = RiderApplicationFixtures::user('location-customer-'.Str::random(10).'@example.test');
        $this->customerRequest($customer, 'GET', "/api/v1/customer/orders/{$order->getKey()}/tracking")
            ->assertOk()
            ->assertJsonPath('data.live_location.latitude', 14.6012);
        $this->customerRequest($otherCustomer, 'GET', "/api/v1/customer/orders/{$order->getKey()}/tracking")
            ->assertNotFound();

        $delivery->forceFill(['status' => 'delivered'])->save();
        $this->customerRequest($customer, 'GET', "/api/v1/customer/orders/{$order->getKey()}/tracking")
            ->assertOk()
            ->assertJsonPath('data.live_location', null)
            ->assertJsonPath('data.live_location_unavailable', false);
        $this->assertFalse(Cache::has($key));
    }

    public function test_customer_tracking_does_not_return_an_expired_location(): void
    {
        [$order, $rider, $delivery, , $customer] = $this->acceptedLocationScenario();
        $key = $this->deliveryLocationKey($delivery, $rider['profile']);
        $this->dispatchLocationKeys[] = $key;
        $this->riderRequest($rider['user'], 'POST', "/api/v1/driver/deliveries/{$delivery->getKey()}/location", [
            'latitude' => 14.6012,
            'longitude' => 121.0112,
        ])->assertOk();

        try {
            Carbon::setTestNow(now()->addSeconds(121));
            $this->customerRequest($customer, 'GET', "/api/v1/customer/orders/{$order->getKey()}/tracking")
                ->assertOk()
                ->assertJsonPath('data.live_location', null)
                ->assertJsonPath('data.live_location_unavailable', true);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_logout_clears_rider_location_and_releases_pre_pickup_assignment(): void
    {
        [, $rider, $delivery] = $this->acceptedLocationScenario();
        $key = $this->deliveryLocationKey($delivery, $rider['profile']);
        $this->dispatchLocationKeys[] = $key;
        $this->riderRequest($rider['user'], 'POST', "/api/v1/driver/deliveries/{$delivery->getKey()}/location", [
            'latitude' => 14.6012,
            'longitude' => 121.0112,
        ])->assertOk();

        $this->riderRequest($rider['user'], 'POST', '/api/v1/auth/logout')->assertOk();

        $this->assertFalse(Cache::has($key));
        $this->assertFalse(Cache::has("rider:{$rider['profile']->getKey()}:dispatch-location"));
        $this->assertSame('offline', $rider['profile']->fresh()->availability);
        $this->assertNull($delivery->fresh()->rider_id);
    }

    public function test_terminal_delivery_completion_clears_both_location_keys_without_touching_another_rider(): void
    {
        [, $rider, $delivery] = $this->acceptedLocationScenario();
        [, $otherRider, $otherDelivery] = $this->acceptedLocationScenario();
        [$deliveryKey, $dispatchKey] = $this->seedDeliveryLocationKeys($delivery, $rider['profile']);
        [$otherDeliveryKey, $otherDispatchKey] = $this->seedDeliveryLocationKeys(
            $otherDelivery,
            $otherRider['profile'],
        );

        DB::shouldReceive('afterCommit')
            ->once()
            ->andReturnUsing(static fn (callable $callback) => $callback());
        $delivery->forceFill(['status' => 'delivered'])->save();

        $this->assertFalse(Cache::has($deliveryKey));
        $this->assertFalse(Cache::has($dispatchKey));
        $this->assertTrue(Cache::has($otherDeliveryKey));
        $this->assertTrue(Cache::has($otherDispatchKey));
    }

    public function test_terminal_delivery_failure_clears_both_location_keys(): void
    {
        [, $rider, $delivery] = $this->acceptedLocationScenario();
        [$deliveryKey, $dispatchKey] = $this->seedDeliveryLocationKeys($delivery, $rider['profile']);

        DB::shouldReceive('afterCommit')
            ->once()
            ->andReturnUsing(static fn (callable $callback) => $callback());
        $delivery->forceFill(['status' => 'failed'])->save();

        $this->assertFalse(Cache::has($deliveryKey));
        $this->assertFalse(Cache::has($dispatchKey));
    }

    public function test_terminal_delivery_cleanup_uses_previous_rider_when_updated_rider_is_null(): void
    {
        [, $rider, $delivery] = $this->acceptedLocationScenario();
        [$deliveryKey, $dispatchKey] = $this->seedDeliveryLocationKeys($delivery, $rider['profile']);

        DB::shouldReceive('afterCommit')
            ->once()
            ->andReturnUsing(static fn (callable $callback) => $callback());
        $delivery->forceFill(['status' => 'failed', 'rider_id' => null])->save();

        $this->assertNull($delivery->fresh()->rider_id);
        $this->assertFalse(Cache::has($deliveryKey));
        $this->assertFalse(Cache::has($dispatchKey));
    }

    public function test_order_cancellation_clears_location_keys_when_it_unassigns_the_rider(): void
    {
        [$order, $rider, $delivery] = $this->dispatchScenario();
        $dispatch = app(RiderDispatchService::class);
        $dispatch->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
        $delivery = Delivery::query()->where('order_id', $order->getKey())->firstOrFail();
        [$deliveryKey, $dispatchKey] = $this->seedDeliveryLocationKeys($delivery, $rider['profile']);

        $dispatch->cancelForOrder((int) $order->getKey());

        $this->assertNull($delivery->fresh()->rider_id);
        $this->assertFalse(Cache::has($deliveryKey));
        $this->assertFalse(Cache::has($dispatchKey));
    }

    public function test_concurrent_ready_orders_do_not_assign_two_active_offers_to_one_rider(): void
    {
        $this->createCommittedConcurrentDispatchFixture();
        $worker = base_path('tests/Support/concurrent_rider_dispatch.php');
        $barrier = sys_get_temp_dir().DIRECTORY_SEPARATOR.'salo-rider-dispatch-'.Str::uuid().'.go';
        $readyPaths = [
            sys_get_temp_dir().DIRECTORY_SEPARATOR.'salo-rider-dispatch-'.Str::uuid().'.ready',
            sys_get_temp_dir().DIRECTORY_SEPARATOR.'salo-rider-dispatch-'.Str::uuid().'.ready',
        ];
        $this->concurrencyTempFiles = [$barrier, ...$readyPaths];
        $processes = [];

        try {
            foreach ($this->concurrencyFixture['order_ids'] as $index => $orderId) {
                $process = new Process([
                    PHP_BINARY,
                    $worker,
                    (string) $orderId,
                    (string) $this->concurrencyFixture['rider_id'],
                    $readyPaths[$index],
                    $barrier,
                ], base_path(), [
                    'APP_ENV' => 'testing',
                    'DB_CONNECTION' => 'mysql',
                    'DB_DATABASE' => 'salo_test',
                ]);
                $process->setTimeout(45);
                $process->start();
                $processes[] = $process;
            }

            $deadline = microtime(true) + 30;
            while (count(array_filter($readyPaths, 'is_file')) !== count($readyPaths)) {
                if (microtime(true) >= $deadline) {
                    $this->fail('Concurrent dispatch workers did not become ready.');
                }
                usleep(10_000);
            }
            file_put_contents($barrier, 'go');
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput().$process->getOutput());
            }
        } finally {
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop(1);
                }
            }
        }

        $connection = DB::connection('mysql_concurrency');
        $this->assertSame(2, $connection->table('deliveries')
            ->whereIn('order_id', $this->concurrencyFixture['order_ids'])
            ->count());
        $this->assertSame(1, $connection->table('deliveries')
            ->whereIn('order_id', $this->concurrencyFixture['order_ids'])
            ->where('rider_id', $this->concurrencyFixture['rider_id'])
            ->count());
        $this->assertSame(1, $connection->table('delivery_offers')
            ->whereIn('delivery_id', $connection->table('deliveries')
                ->select('id')
                ->whereIn('order_id', $this->concurrencyFixture['order_ids']))
            ->count());
    }

    private function dispatchScenario(bool $withRider = true): array
    {
        $owner = RiderApplicationFixtures::user('dispatch-owner-'.Str::random(10).'@example.test');
        $customer = RiderApplicationFixtures::user('dispatch-customer-'.Str::random(10).'@example.test');
        $barangay = RiderApplicationFixtures::barangay();
        $restaurant = $this->dispatchRestaurant($owner, $barangay->getKey());
        $shift = $this->dispatchShift();
        $zone = $this->dispatchZone($barangay->getKey(), 'Primary dispatch zone');
        $order = $this->dispatchOrder($customer, $restaurant);
        $rider = $withRider
            ? $this->dispatchRider('dispatch-rider-'.Str::random(10).'@example.test', $shift, $zone)
            : null;

        return [$order, $rider, $zone, $owner, $customer];
    }

    private function acceptedLocationScenario(): array
    {
        [$order, $rider, $zone, $owner, $customer] = $this->dispatchScenario();
        $shift = $zone->assignments()->firstOrFail()->shift;
        $dispatch = app(RiderDispatchService::class);
        $dispatch->setAvailability($rider['user'], 'online', 14.6001, 121.0001);
        $delivery = Delivery::query()->where('order_id', $order->getKey())->firstOrFail();
        $offer = DeliveryOffer::query()->where('delivery_id', $delivery->getKey())->firstOrFail();
        $dispatch->respondToOffer($rider['user'], (int) $offer->getKey(), true);
        $this->dispatchLocationKeys[] = "rider:{$rider['profile']->getKey()}:dispatch-location";
        $this->dispatchLocationKeys[] = $this->deliveryLocationKey($delivery, $rider['profile']);

        return [$order, $rider, $delivery, $owner, $customer, $zone, $shift];
    }

    private function deliveryLocationKey(Delivery $delivery, RiderProfile $profile): string
    {
        return "rider:delivery:{$delivery->getKey()}:profile:{$profile->getKey()}:location";
    }

    private function seedDeliveryLocationKeys(Delivery $delivery, RiderProfile $profile): array
    {
        $deliveryKey = $this->deliveryLocationKey($delivery, $profile);
        $dispatchKey = "rider:{$profile->getKey()}:dispatch-location";
        $this->dispatchLocationKeys[] = $deliveryKey;
        $this->dispatchLocationKeys[] = $dispatchKey;
        $point = [
            'latitude' => 14.6012,
            'longitude' => 121.0112,
            'updated_at' => now()->toIso8601String(),
        ];
        Cache::put($deliveryKey, $point, now()->addMinutes(2));
        Cache::put($dispatchKey, $point, now()->addMinutes(2));

        return [$deliveryKey, $dispatchKey];
    }

    private function riderRequest(User $user, string $method, string $uri, array $data = [])
    {
        return $this->actingAs($user, 'sanctum')
            ->withSession(['salo.active_mode' => 'driver'])
            ->withHeaders([
                'Origin' => 'http://localhost:5173',
                'Referer' => 'http://localhost:5173',
                'X-SALO-Mode' => 'driver',
            ])
            ->json($method, $uri, $data);
    }

    private function customerRequest(User $user, string $method, string $uri, array $data = [])
    {
        return $this->actingAs($user, 'sanctum')
            ->withSession(['salo.active_mode' => 'customer'])
            ->withHeaders([
                'Origin' => 'http://localhost:5173',
                'Referer' => 'http://localhost:5173',
                'X-SALO-Mode' => 'customer',
            ])
            ->json($method, $uri, $data);
    }

    private function createCommittedConcurrentDispatchFixture(): void
    {
        config(['database.connections.mysql_concurrency' => config('database.connections.mysql')]);
        DB::purge('mysql_concurrency');
        $connection = DB::connection('mysql_concurrency');
        $connection->beginTransaction();

        try {
            $suffix = Str::upper(Str::random(10));
            $psgcCode = 'T'.$suffix;
            $connection->table('psgc_locations')->insert([
                'code' => $psgcCode,
                'name' => 'Dispatch Test Barangay',
                'level' => 'barangay',
                'full_name' => 'Dispatch Test Barangay',
            ]);
            $userIds = [];
            foreach (['owner', 'customer', 'rider'] as $role) {
                $userIds[$role] = $connection->table('users')->insertGetId([
                    'email' => "dispatch-{$role}-{$suffix}@example.test",
                    'password_hash' => bcrypt('Password123'),
                    'first_name' => 'Dispatch',
                    'last_name' => ucfirst($role),
                    'status' => 'active',
                ]);
            }
            $restaurantId = $connection->table('restaurants')->insertGetId([
                'owner_user_id' => $userIds['owner'],
                'name' => 'Concurrent Dispatch '.$suffix,
                'country_code' => 'PH',
                'psgc_code' => $psgcCode,
                'street' => 'Dispatch Street',
                'formatted_address' => 'Dispatch Street, Dispatch Test Barangay',
                'latitude' => '14.600000',
                'longitude' => '121.000000',
                'status' => 'approved',
                'is_published' => 1,
                'is_24_7' => 1,
            ]);
            $zoneId = $connection->table('zones')->insertGetId([
                'psgc_code' => $psgcCode,
                'name' => 'Concurrent Dispatch Zone '.$suffix,
                'center_lat' => '14.600000',
                'center_lng' => '121.000000',
                'radius_km' => '5.00',
                'is_active' => 1,
            ]);
            $shiftId = $connection->table('shifts')->insertGetId([
                'name' => 'Concurrent Dispatch Shift '.$suffix,
                'start_time' => '00:01:00',
                'end_time' => '23:59:00',
            ]);
            $riderId = $connection->table('rider_profiles')->insertGetId([
                'user_id' => $userIds['rider'],
                'application_status' => 'approved',
                'status' => 'active',
                'availability' => 'online',
                'psgc_code' => $psgcCode,
                'street' => 'Rider Dispatch Street',
                'formatted_address' => 'Rider Dispatch Street, Dispatch Test Barangay',
                'home_lat' => '14.600000',
                'home_lng' => '121.000000',
            ]);
            $connection->table('rider_shift_assignments')->insert([
                'rider_id' => $riderId,
                'zone_id' => $zoneId,
                'shift_id' => $shiftId,
                'status' => 'assigned',
                'assigned_by' => 'system',
            ]);
            $checkoutId = $connection->table('checkout_groups')->insertGetId([
                'user_id' => $userIds['customer'],
                'reference_code' => 'G'.Str::upper(Str::random(11)),
                'idempotency_key' => 'dispatch-'.$suffix,
                'placed_at' => now(),
            ]);
            $orderIds = [];
            $references = [];
            for ($index = 0; $index < 2; $index++) {
                $referenceCode = 'O'.Str::upper(Str::random(11));
                $orderId = $connection->table('orders')->insertGetId([
                    'checkout_id' => $checkoutId,
                    'restaurant_id' => $restaurantId,
                    'reference_code' => $referenceCode,
                    'order_type' => 'delivery',
                    'status' => 'ready',
                    'recipient_name' => 'Dispatch Test Customer',
                    'recipient_phone' => '+639171234567',
                    'delivery_address_text' => 'Private Dispatch Address',
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
                $connection->table('payments')->insert([
                    'order_id' => $orderId,
                    'method' => 'cod',
                    'status' => 'unpaid',
                    'amount' => '235.00',
                ]);
                $orderIds[] = $orderId;
                $references[] = $referenceCode;
            }

            $this->concurrencyFixture = [
                'psgc_code' => $psgcCode,
                'user_ids' => array_values($userIds),
                'restaurant_id' => $restaurantId,
                'zone_id' => $zoneId,
                'shift_id' => $shiftId,
                'rider_id' => $riderId,
                'checkout_id' => $checkoutId,
                'order_ids' => $orderIds,
                'references' => $references,
            ];
            $connection->commit();
        } catch (\Throwable $exception) {
            $connection->rollBack();
            throw $exception;
        }
    }

    private function cleanupConcurrencyFixture(): void
    {
        if ($this->concurrencyFixture === []) {
            return;
        }
        $connection = DB::connection('mysql_concurrency');
        $deliveryIds = $connection->table('deliveries')
            ->whereIn('order_id', $this->concurrencyFixture['order_ids'])
            ->pluck('id');
        $connection->table('delivery_offers')->whereIn('delivery_id', $deliveryIds)->delete();
        $connection->table('deliveries')->whereIn('order_id', $this->concurrencyFixture['order_ids'])->delete();
        $connection->table('notifications')->whereIn('related_reference', $this->concurrencyFixture['references'])->delete();
        $connection->table('payments')->whereIn('order_id', $this->concurrencyFixture['order_ids'])->delete();
        $connection->table('orders')->whereIn('id', $this->concurrencyFixture['order_ids'])->delete();
        $connection->table('checkout_groups')->where('id', $this->concurrencyFixture['checkout_id'])->delete();
        $connection->table('rider_shift_assignments')->where('rider_id', $this->concurrencyFixture['rider_id'])->delete();
        $connection->table('rider_profiles')->where('id', $this->concurrencyFixture['rider_id'])->delete();
        $connection->table('zones')->where('id', $this->concurrencyFixture['zone_id'])->delete();
        $connection->table('shifts')->where('id', $this->concurrencyFixture['shift_id'])->delete();
        $connection->table('restaurants')->where('id', $this->concurrencyFixture['restaurant_id'])->delete();
        $connection->table('users')->whereIn('id', $this->concurrencyFixture['user_ids'])->delete();
        $connection->table('psgc_locations')->where('code', $this->concurrencyFixture['psgc_code'])->delete();
        DB::purge('mysql_concurrency');
    }
}
