<?php

namespace Tests\Feature;

use App\Models\PlatformSetting;
use App\Models\RiderProfile;
use App\Models\Shift;
use App\Models\Zone;
use App\Notifications\RiderActivationNotification;
use App\Services\RiderSchedulingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\Support\RiderApplicationFixtures;
use Tests\TestCase;

class RiderSchedulingTest extends TestCase
{
    private array $concurrencyFixture = [];
    private array $concurrencyTempFiles = [];

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ]);
        PlatformSetting::query()->updateOrCreate(
            ['setting_key' => 'max_zone_distance_km'],
            ['value' => '10'],
        );
    }

    protected function tearDown(): void
    {
        if ($this->concurrencyFixture !== []) {
            $connection = DB::connection('mysql_concurrency');
            $connection->table('rider_shift_assignments')
                ->whereIn('rider_id', $this->concurrencyFixture['rider_ids'])
                ->delete();
            $connection->table('rider_preferred_shifts')
                ->whereIn('rider_id', $this->concurrencyFixture['rider_ids'])
                ->delete();
            $connection->table('rider_profiles')->whereIn('id', $this->concurrencyFixture['rider_ids'])->delete();
            $connection->table('users')->whereIn('id', $this->concurrencyFixture['user_ids'])->delete();
            $connection->table('zone_shift_capacities')
                ->where('zone_id', $this->concurrencyFixture['zone_id'])
                ->delete();
            $connection->table('zones')->where('id', $this->concurrencyFixture['zone_id'])->delete();
            $connection->table('psgc_locations')->where('code', $this->concurrencyFixture['psgc_code'])->delete();
            DB::purge('mysql_concurrency');
        }
        foreach ($this->concurrencyTempFiles as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }

        parent::tearDown();
    }

    public function test_nearest_zone_wins_and_equal_distances_use_zone_id_as_tiebreaker(): void
    {
        $shift = $this->shift();
        $profile = $this->rider('nearest-zone@example.test', $shift, 6.90, 122.06);
        $farther = $this->zone('Farther zone', 6.93, 122.06, $shift, 5);
        $nearestTieA = $this->zone('Nearest tie A', 6.91, 122.06, $shift, 5);
        $this->zone('Nearest tie B', 6.91, 122.06, $shift, 5);

        $assignment = app(RiderSchedulingService::class)->assignRiderForShift(
            (int) $profile->getKey(),
            (int) $shift->getKey(),
        );

        $this->assertSame('assigned', $assignment->status);
        $this->assertSame((int) $nearestTieA->getKey(), (int) $assignment->zone_id);
        $this->assertNotSame((int) $farther->getKey(), (int) $assignment->zone_id);
    }

    public function test_full_nearest_zone_falls_back_to_the_next_nearest_within_setting(): void
    {
        $shift = $this->shift();
        $nearest = $this->zone('Nearest zone', 6.91, 122.06, $shift, 1);
        $nextNearest = $this->zone('Next nearest zone', 6.92, 122.06, $shift, 1);
        $occupant = $this->rider('zone-occupant@example.test', $shift, 6.90, 122.06);
        $applicant = $this->rider('zone-next@example.test', $shift, 6.90, 122.06);
        $service = app(RiderSchedulingService::class);

        $occupied = $service->assignRiderForShift((int) $occupant->getKey(), (int) $shift->getKey());
        $assigned = $service->assignRiderForShift((int) $applicant->getKey(), (int) $shift->getKey());

        $this->assertSame((int) $nearest->getKey(), (int) $occupied->zone_id);
        $this->assertSame((int) $nextNearest->getKey(), (int) $assigned->zone_id);
    }

    public function test_waitlisted_rider_is_assigned_when_capacity_increases(): void
    {
        $shift = $this->shift();
        $zone = $this->zone('Capacity increase zone', 6.90, 122.06, $shift, 1);
        $first = $this->rider('capacity-first@example.test', $shift, 6.90, 122.06);
        $second = $this->rider('capacity-second@example.test', $shift, 6.90, 122.06);
        $service = app(RiderSchedulingService::class);

        $service->assignRiderForShift((int) $first->getKey(), (int) $shift->getKey());
        $waitlisted = $service->assignRiderForShift((int) $second->getKey(), (int) $shift->getKey());
        $this->assertSame('waitlisted', $waitlisted->status);

        $service->setCapacity((int) $zone->getKey(), (int) $shift->getKey(), 2, RiderApplicationFixtures::admin('capacity-admin@example.test'));

        $this->assertDatabaseHas('rider_shift_assignments', [
            'rider_id' => $second->getKey(),
            'zone_id' => $zone->getKey(),
            'shift_id' => $shift->getKey(),
            'status' => 'assigned',
        ]);
    }

    public function test_lowering_capacity_does_not_evict_existing_assignments(): void
    {
        $shift = $this->shift();
        $zone = $this->zone('Lowered capacity zone', 6.90, 122.06, $shift, 2);
        $first = $this->rider('capacity-lower-a@example.test', $shift, 6.90, 122.06);
        $second = $this->rider('capacity-lower-b@example.test', $shift, 6.90, 122.06);
        $service = app(RiderSchedulingService::class);
        $service->assignRiderForShift((int) $first->getKey(), (int) $shift->getKey());
        $service->assignRiderForShift((int) $second->getKey(), (int) $shift->getKey());

        $service->setCapacity((int) $zone->getKey(), (int) $shift->getKey(), 1, RiderApplicationFixtures::admin('lower-admin@example.test'));

        $this->assertSame(2, DB::table('rider_shift_assignments')
            ->where('zone_id', $zone->getKey())
            ->where('shift_id', $shift->getKey())
            ->where('status', 'assigned')
            ->count());
    }

    public function test_rider_without_home_coordinates_is_waitlisted(): void
    {
        $shift = $this->shift();
        $this->zone('Coordinates zone', 6.90, 122.06, $shift, 2);
        $profile = $this->rider('no-home-coordinates@example.test', $shift, null, null);

        $assignment = app(RiderSchedulingService::class)->assignRiderForShift(
            (int) $profile->getKey(),
            (int) $shift->getKey(),
        );

        $this->assertSame('waitlisted', $assignment->status);
        $this->assertStringContainsString('coordinates', $assignment->reason);
    }

    public function test_application_approval_assigns_preferred_shift_before_otp_activation(): void
    {
        $shift = $this->shift();
        $zone = $this->zone('Approval assignment zone', 6.90, 122.06, $shift, 2);
        $user = RiderApplicationFixtures::user('approval-scheduling@example.test');
        $application = RiderApplicationFixtures::submittedApplication($user);
        $application->forceFill(['home_lat' => 6.90, 'home_lng' => 122.06])->save();
        $application->preferredShifts()->sync([$shift->getKey()]);
        $admin = RiderApplicationFixtures::admin('approval-scheduling-admin@example.test');

        $response = $this->actingAs($admin, 'web')
            ->withSession(['salo.active_mode' => 'admin'])
            ->postJson('/api/v1/admin/applications/rider/'.$application->getKey().'/approve');

        $response->assertOk()
            ->assertJsonPath('data.profile.status', 'pending_activation')
            ->assertJsonPath('data.profile.shift_assignments.0.zone_id', (string) $zone->getKey())
            ->assertJsonPath('data.profile.shift_assignments.0.status', 'assigned');
        Notification::assertSentTo($user, RiderActivationNotification::class);
    }

    public function test_admin_override_requires_reason_and_audits_the_change(): void
    {
        $shift = $this->shift();
        $firstZone = $this->zone('Override source zone', 6.90, 122.06, $shift, 2);
        $targetZone = $this->zone('Override target zone', 6.91, 122.06, $shift, 2);
        $profile = $this->rider('override-rider@example.test', $shift, 6.90, 122.06);
        $assignment = app(RiderSchedulingService::class)->assignRiderForShift(
            (int) $profile->getKey(),
            (int) $shift->getKey(),
        );
        $this->assertSame((int) $firstZone->getKey(), (int) $assignment->zone_id);
        $admin = RiderApplicationFixtures::admin('override-admin@example.test');
        $path = '/api/v1/admin/rider-scheduling/riders/'.$profile->getKey().'/assignments/'.$assignment->getKey().'/override';

        $this->actingAs($admin, 'web')
            ->withSession(['salo.active_mode' => 'admin'])
            ->postJson($path, [
                'zone_id' => $targetZone->getKey(),
                'shift_id' => $shift->getKey(),
                'reason' => '',
            ])->assertUnprocessable();

        $this->postJson($path, [
            'zone_id' => $targetZone->getKey(),
            'shift_id' => $shift->getKey(),
            'reason' => 'Coverage balancing',
        ])->assertOk()
            ->assertJsonPath('data.zone_id', (string) $targetZone->getKey())
            ->assertJsonPath('data.assigned_by', 'admin')
            ->assertJsonPath('data.reason', 'Coverage balancing');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'rider_scheduling_updated',
            'entity_type' => 'rider_shift_assignment',
            'entity_id' => (string) $assignment->getKey(),
            'actor_user_id' => $admin->getKey(),
        ]);
    }

    public function test_suspension_releases_capacity_and_waitlist_is_rechecked(): void
    {
        $shift = $this->shift();
        $zone = $this->zone('Suspension release zone', 6.90, 122.06, $shift, 1);
        $suspendedRider = $this->rider('suspension-release@example.test', $shift, 6.90, 122.06);
        $waitlistedRider = $this->rider('suspension-waitlist@example.test', $shift, 6.90, 122.06);
        $suspendedRider->forceFill(['status' => 'active'])->save();
        $service = app(RiderSchedulingService::class);
        $initial = $service->assignRiderForShift((int) $suspendedRider->getKey(), (int) $shift->getKey());
        $waiting = $service->assignRiderForShift((int) $waitlistedRider->getKey(), (int) $shift->getKey());
        $this->assertSame('assigned', $initial->status);
        $this->assertSame('waitlisted', $waiting->status);

        $service->changeRiderStatus(
            (int) $suspendedRider->getKey(),
            'suspended',
            RiderApplicationFixtures::admin('suspension-admin@example.test'),
        );

        $this->assertDatabaseHas('rider_shift_assignments', [
            'rider_id' => $suspendedRider->getKey(),
            'status' => 'waitlisted',
            'zone_id' => null,
        ]);
        $this->assertDatabaseHas('rider_shift_assignments', [
            'rider_id' => $waitlistedRider->getKey(),
            'zone_id' => $zone->getKey(),
            'status' => 'assigned',
        ]);
    }

    public function test_suspended_rider_is_not_eligible_for_assignment(): void
    {
        $shift = $this->shift();
        $this->zone('Suspended eligibility zone', 6.90, 122.06, $shift, 2);
        $profile = $this->rider('suspended-eligibility@example.test', $shift, 6.90, 122.06);
        $profile->forceFill(['status' => 'suspended'])->save();

        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        app(RiderSchedulingService::class)->assignRiderForShift((int) $profile->getKey(), (int) $shift->getKey());
    }

    public function test_concurrent_assignments_never_exceed_zone_shift_capacity(): void
    {
        $shiftId = (int) $this->shift()->getKey();
        $this->createCommittedConcurrencyFixture($shiftId);
        $worker = base_path('tests/Support/concurrent_rider_assignment.php');
        $barrier = sys_get_temp_dir().DIRECTORY_SEPARATOR.'salo-rider-schedule-'.Str::uuid().'.go';
        $readyPaths = [
            sys_get_temp_dir().DIRECTORY_SEPARATOR.'salo-rider-schedule-'.Str::uuid().'.ready',
            sys_get_temp_dir().DIRECTORY_SEPARATOR.'salo-rider-schedule-'.Str::uuid().'.ready',
        ];
        $this->concurrencyTempFiles = [$barrier, ...$readyPaths];
        $processes = [];

        try {
            foreach ($this->concurrencyFixture['rider_ids'] as $index => $riderId) {
                $process = new Process([
                    PHP_BINARY,
                    $worker,
                    (string) $riderId,
                    (string) $shiftId,
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
                    $this->fail('Concurrent rider assignment workers did not become ready.');
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

        $statuses = array_map(fn (Process $process): string => trim($process->getOutput()), $processes);
        $this->assertCount(1, array_filter($statuses, fn (string $status): bool => $status === 'assigned'));
        $this->assertCount(1, array_filter($statuses, fn (string $status): bool => $status === 'waitlisted'));
        $this->assertSame(1, DB::connection('mysql_concurrency')->table('rider_shift_assignments')
            ->whereIn('rider_id', $this->concurrencyFixture['rider_ids'])
            ->where('zone_id', $this->concurrencyFixture['zone_id'])
            ->where('shift_id', $shiftId)
            ->where('status', 'assigned')
            ->count());
    }

    private function shift(): Shift
    {
        return Shift::query()->orderBy('id')->firstOrFail();
    }

    private function rider(string $email, Shift $shift, ?float $latitude, ?float $longitude): RiderProfile
    {
        $profile = RiderApplicationFixtures::pendingActivation(
            RiderApplicationFixtures::user($email),
        );
        $profile->forceFill([
            'home_lat' => $latitude,
            'home_lng' => $longitude,
        ])->save();
        $profile->preferredShifts()->sync([$shift->getKey()]);

        return $profile;
    }

    private function zone(string $name, float $latitude, float $longitude, Shift $shift, int $capacity): Zone
    {
        $zone = Zone::query()->create([
            'name' => $name,
            'center_lat' => $latitude,
            'center_lng' => $longitude,
            'radius_km' => 5,
            'is_active' => true,
        ]);
        DB::table('zone_shift_capacities')->insert([
            'zone_id' => $zone->getKey(),
            'shift_id' => $shift->getKey(),
            'max_riders' => $capacity,
        ]);

        return $zone;
    }

    private function createCommittedConcurrencyFixture(int $shiftId): void
    {
        config(['database.connections.mysql_concurrency' => config('database.connections.mysql')]);
        DB::purge('mysql_concurrency');
        $connection = DB::connection('mysql_concurrency');
        $connection->beginTransaction();

        try {
            $psgcCode = 'T'.Str::upper(Str::random(10));
            $connection->table('psgc_locations')->insert([
                'code' => $psgcCode,
                'name' => 'Concurrent Test Barangay',
                'level' => 'barangay',
                'full_name' => 'Concurrent Test Barangay',
            ]);
            $zoneId = $connection->table('zones')->insertGetId([
                'name' => 'Concurrent '.Str::random(12),
                'center_lat' => 6.90,
                'center_lng' => 122.06,
                'radius_km' => 5,
                'is_active' => true,
            ]);
            $userIds = [];
            $riderIds = [];

            for ($index = 0; $index < 2; $index++) {
                $userId = $connection->table('users')->insertGetId([
                    'email' => 'concurrent-'.Str::lower(Str::random(20)).'@example.test',
                    'password_hash' => bcrypt('Password123'),
                    'first_name' => 'Concurrent',
                    'last_name' => 'Rider '.$index,
                    'status' => 'active',
                ]);
                $riderId = $connection->table('rider_profiles')->insertGetId([
                    'user_id' => $userId,
                    'application_status' => 'approved',
                    'status' => 'active',
                    'psgc_code' => $psgcCode,
                    'street' => 'Concurrent Test Street',
                    'formatted_address' => 'Concurrent Test Street, Test Barangay',
                    'home_lat' => 6.90,
                    'home_lng' => 122.06,
                ]);
                $connection->table('rider_preferred_shifts')->insert([
                    'rider_id' => $riderId,
                    'shift_id' => $shiftId,
                ]);
                $userIds[] = $userId;
                $riderIds[] = $riderId;
            }
            $connection->table('zone_shift_capacities')->insert([
                'zone_id' => $zoneId,
                'shift_id' => $shiftId,
                'max_riders' => 1,
            ]);
            $this->concurrencyFixture = [
                'psgc_code' => $psgcCode,
                'zone_id' => $zoneId,
                'user_ids' => $userIds,
                'rider_ids' => $riderIds,
            ];
            $connection->commit();
        } catch (\Throwable $exception) {
            $connection->rollBack();
            throw $exception;
        }
    }
}
