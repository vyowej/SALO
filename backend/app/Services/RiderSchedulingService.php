<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\RiderProfile;
use App\Models\RiderShiftAssignment;
use App\Models\User;
use App\Models\Zone;
use App\Repositories\Contracts\PlatformSettingsRepository;
use App\Repositories\Contracts\RiderSchedulingRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RiderSchedulingService
{
    public function __construct(
        private readonly RiderSchedulingRepository $scheduling,
        private readonly PlatformSettingsRepository $settings,
        private readonly RiderDispatchService $riderDispatch,
    ) {}

    public function overview(): array
    {
        $counts = $this->scheduling->assignments()
            ->selectRaw('zone_id, shift_id, COUNT(*) AS assigned_count')
            ->where('status', 'assigned')
            ->groupBy('zone_id', 'shift_id')
            ->get()
            ->mapWithKeys(fn ($row): array => [$row->zone_id.':'.$row->shift_id => (int) $row->assigned_count]);

        $shifts = $this->scheduling->shifts()->orderBy('start_time')->get();
        $zones = $this->scheduling->zones()
            ->with('capacities')
            ->orderBy('name')
            ->get()
            ->map(function (Zone $zone) use ($shifts, $counts): array {
                $capacityByShift = $zone->capacities->keyBy('shift_id');

                return [
                    'id' => (string) $zone->getKey(),
                    'psgc_code' => $zone->psgc_code,
                    'name' => $zone->name,
                    'center_lat' => (float) $zone->center_lat,
                    'center_lng' => (float) $zone->center_lng,
                    'radius_km' => (float) $zone->radius_km,
                    'is_active' => (bool) $zone->is_active,
                    'capacities' => $shifts->map(function ($shift) use ($zone, $capacityByShift, $counts): array {
                        $capacity = $capacityByShift->get($shift->getKey());
                        $assigned = $capacity === null
                            ? 0
                            : ($counts->get($zone->getKey().':'.$shift->getKey()) ?? 0);

                        return [
                            'shift_id' => (string) $shift->getKey(),
                            'shift_name' => $shift->name,
                            'start_time' => substr((string) $shift->start_time, 0, 5),
                            'end_time' => substr((string) $shift->end_time, 0, 5),
                            'max_riders' => $capacity === null ? null : (int) $capacity->max_riders,
                            'assigned_riders' => $assigned,
                            'available_slots' => $capacity === null ? 0 : max(0, (int) $capacity->max_riders - $assigned),
                        ];
                    })->values()->all(),
                ];
            })->values()->all();

        return [
            'zones' => $zones,
            'shifts' => $shifts->map(fn ($shift): array => [
                'id' => (string) $shift->getKey(),
                'name' => $shift->name,
                'start_time' => substr((string) $shift->start_time, 0, 5),
                'end_time' => substr((string) $shift->end_time, 0, 5),
            ])->values()->all(),
            'max_zone_distance_km' => $this->maxZoneDistanceKm(),
        ];
    }

    public function assignments(array $filters): LengthAwarePaginator
    {
        $query = $this->scheduling->assignments()
            ->with(['rider.user', 'zone', 'shift'])
            ->orderByRaw("FIELD(status, 'waitlisted', 'assigned')")
            ->orderBy('created_at')
            ->orderBy('id');

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['shift_id'])) {
            $query->where('shift_id', $filters['shift_id']);
        }

        return $query->paginate(min(100, max(1, (int) ($filters['per_page'] ?? 50))));
    }

    public function createZone(array $data, User $admin): Zone
    {
        $zone = DB::transaction(function () use ($data, $admin): Zone {
            $zone = $this->scheduling->zones()->create($this->zoneAttributes($data));
            foreach ($data['capacities'] as $capacity) {
                DB::table('zone_shift_capacities')->insert([
                    'zone_id' => $zone->getKey(),
                    'shift_id' => $capacity['shift_id'],
                    'max_riders' => $capacity['max_riders'],
                ]);
            }
            $this->audit($admin, 'rider_zone', $zone->getKey(), null, $this->zoneSnapshot($zone));

            return $zone->load('capacities');
        });
        $this->recheckWaitlist();

        return $zone;
    }

    public function updateZone(int $zoneId, array $data, User $admin): Zone
    {
        $recheck = false;
        $zone = DB::transaction(function () use ($zoneId, $data, $admin, &$recheck): Zone {
            $zone = $this->scheduling->zones()->whereKey($zoneId)->lockForUpdate()->firstOrFail();
            $before = $this->zoneSnapshot($zone);
            $zone->fill($this->zoneAttributes($data))->save();
            if ($before['is_active'] && ! $zone->is_active) {
                $this->releaseZoneAssignments($zone, 'Zone deactivated');
                $recheck = true;
            } elseif (! $before['is_active'] && $zone->is_active) {
                $recheck = true;
            }
            $this->audit($admin, 'rider_zone', $zone->getKey(), $before, $this->zoneSnapshot($zone));

            return $zone->load('capacities');
        });

        if ($recheck) {
            $this->recheckWaitlist();
        }

        return $zone;
    }

    public function setCapacity(int $zoneId, int $shiftId, int $maxRiders, User $admin): array
    {
        $increased = DB::transaction(function () use ($zoneId, $shiftId, $maxRiders, $admin): bool {
            $zone = $this->scheduling->zones()->whereKey($zoneId)->lockForUpdate()->firstOrFail();
            $this->scheduling->shifts()->whereKey($shiftId)->firstOrFail();
            $capacity = $this->scheduling->capacities()
                ->where('zone_id', $zoneId)
                ->where('shift_id', $shiftId)
                ->lockForUpdate()
                ->first();
            $before = $capacity?->max_riders === null ? null : (int) $capacity->max_riders;
            DB::table('zone_shift_capacities')->updateOrInsert(
                ['zone_id' => $zoneId, 'shift_id' => $shiftId],
                ['max_riders' => $maxRiders],
            );
            $this->audit($admin, 'zone_shift_capacity', $zoneId, [
                'shift_id' => $shiftId,
                'max_riders' => $before,
            ], [
                'shift_id' => $shiftId,
                'max_riders' => $maxRiders,
            ]);

            return $before === null || $maxRiders > $before;
        });

        if ($increased) {
            $this->recheckWaitlist();
        }

        return $this->overview();
    }

    public function assignApprovedRider(RiderProfile $profile): void
    {
        $shiftIds = $profile->preferredShifts()->orderBy('shifts.id')->pluck('shifts.id');
        foreach ($shiftIds as $shiftId) {
            $this->assignRiderForShift((int) $profile->getKey(), (int) $shiftId);
        }
    }

    public function assignRiderForShift(int $riderId, int $shiftId): RiderShiftAssignment
    {
        return DB::transaction(function () use ($riderId, $shiftId): RiderShiftAssignment {
            $profile = $this->scheduling->profiles()->whereKey($riderId)->lockForUpdate()->firstOrFail();
            $this->assertEligible($profile);
            $this->scheduling->shifts()->whereKey($shiftId)->firstOrFail();
            if (! $profile->preferredShifts()->whereKey($shiftId)->exists()) {
                throw ValidationException::withMessages(['shift_id' => ['This shift is not in the rider’s preferred shifts.']]);
            }

            return $this->assignForShiftLocked($profile, $shiftId);
        }, 3);
    }

    public function recheckWaitlist(): int
    {
        $assignmentIds = $this->scheduling->assignments()
            ->where('status', 'waitlisted')
            ->orderBy('created_at')
            ->orderBy('id')
            ->pluck('id');
        $assigned = 0;

        foreach ($assignmentIds as $assignmentId) {
            $wasAssigned = DB::transaction(function () use ($assignmentId): bool {
                $reference = $this->scheduling->assignments()->whereKey($assignmentId)->first();
                if ($reference === null) {
                    return false;
                }
                $profile = $this->scheduling->profiles()->whereKey($reference->rider_id)->lockForUpdate()->first();
                if ($profile === null || ! $this->isEligible($profile)) {
                    return false;
                }
                $assignment = $this->scheduling->assignments()
                    ->whereKey($assignmentId)
                    ->where('rider_id', $profile->getKey())
                    ->lockForUpdate()
                    ->first();
                if ($assignment === null || $assignment->status !== 'waitlisted') {
                    return false;
                }
                if (! $profile->preferredShifts()->whereKey($assignment->shift_id)->exists()) {
                    return false;
                }

                $result = $this->assignForShiftLocked($profile, (int) $assignment->shift_id);

                return $result->status === 'assigned';
            }, 3);

            $assigned += $wasAssigned ? 1 : 0;
        }

        return $assigned;
    }

    public function overrideAssignment(
        int $riderId,
        int $assignmentId,
        int $zoneId,
        int $shiftId,
        string $reason,
        User $admin,
    ): RiderShiftAssignment {
        $freedCapacity = false;
        $result = DB::transaction(function () use ($riderId, $assignmentId, $zoneId, $shiftId, $reason, $admin, &$freedCapacity): RiderShiftAssignment {
            $profile = $this->scheduling->profiles()->whereKey($riderId)->lockForUpdate()->firstOrFail();
            $this->assertEligible($profile);
            $assignment = $this->scheduling->assignments()
                ->whereKey($assignmentId)
                ->where('rider_id', $riderId)
                ->lockForUpdate()
                ->firstOrFail();
            $this->scheduling->shifts()->whereKey($shiftId)->firstOrFail();
            $zone = $this->scheduling->zones()->whereKey($zoneId)->where('is_active', true)->first();
            if ($zone === null) {
                throw ValidationException::withMessages(['zone_id' => ['Choose an active delivery zone.']]);
            }
            $before = $this->assignmentSnapshot($assignment->load(['zone', 'shift']));
            $capacityLocks = [[$zoneId, $shiftId]];
            if ($assignment->status === 'assigned' && $assignment->zone_id !== null) {
                $capacityLocks[] = [(int) $assignment->zone_id, (int) $assignment->shift_id];
            }
            usort($capacityLocks, fn (array $left, array $right): int => [$left[0], $left[1]] <=> [$right[0], $right[1]]);
            foreach (array_unique(array_map(fn (array $pair): string => $pair[0].':'.$pair[1], $capacityLocks)) as $pair) {
                [$lockedZone, $lockedShift] = array_map('intval', explode(':', $pair));
                $this->lockCapacity($lockedZone, $lockedShift);
            }
            $capacity = (int) DB::table('zone_shift_capacities')
                ->where('zone_id', $zoneId)
                ->where('shift_id', $shiftId)
                ->value('max_riders');
            if ($capacity < 1) {
                throw ValidationException::withMessages(['zone_id' => ['Set a capacity for this zone and shift before assigning a rider.']]);
            }
            $duplicateShift = $this->scheduling->assignments()
                ->where('rider_id', $riderId)
                ->where('shift_id', $shiftId)
                ->where('id', '<>', $assignment->getKey())
                ->exists();
            if ($duplicateShift) {
                throw ValidationException::withMessages(['shift_id' => ['This rider already has an assignment for the selected shift.']]);
            }
            $assignedIds = $this->scheduling->assignments()
                ->where('zone_id', $zoneId)
                ->where('shift_id', $shiftId)
                ->where('status', 'assigned')
                ->lockForUpdate()
                ->pluck('id');
            $used = $assignedIds->reject(fn ($id): bool => (int) $id === (int) $assignment->getKey())->count();
            if ($used >= $capacity) {
                throw ValidationException::withMessages(['zone_id' => ['This zone is at capacity for the selected shift.']]);
            }

            $previousZoneId = $assignment->zone_id;
            $previousShiftId = (int) $assignment->shift_id;
            $previousStatus = $assignment->status;
            $assignment->forceFill([
                'zone_id' => $zoneId,
                'shift_id' => $shiftId,
                'status' => 'assigned',
                'assigned_by' => 'admin',
                'assigned_by_user_id' => $admin->getKey(),
                'reason' => trim($reason),
            ])->save();
            $freedCapacity = $previousStatus === 'assigned'
                && ((int) $previousZoneId !== $zoneId || $previousShiftId !== $shiftId);
            $this->audit($admin, 'rider_shift_assignment', $assignment->getKey(), $before, $this->assignmentSnapshot($assignment->load(['zone', 'shift'])));

            return $assignment->load(['rider.user', 'zone', 'shift']);
        }, 3);

        if ($freedCapacity) {
            $this->recheckWaitlist();
        }

        return $result;
    }

    public function changeRiderStatus(int $riderId, string $status, User $admin): RiderProfile
    {
        $released = false;
        $profile = DB::transaction(function () use ($riderId, $status, $admin, &$released): RiderProfile {
            $profile = $this->scheduling->profiles()->whereKey($riderId)->lockForUpdate()->firstOrFail();
            if ($profile->application_status !== 'approved'
                || ! in_array($profile->status, ['active', 'suspended'], true)) {
                abort(409, 'Only approved riders can have their operating status changed.');
            }
            if ($profile->status === $status) {
                return $profile;
            }
            $before = ['status' => $profile->status];
            $profile->forceFill(['status' => $status])->save();

            if ($status === 'suspended') {
                $profile->shiftAssignments()
                    ->where('status', 'assigned')
                    ->update([
                        'zone_id' => null,
                        'status' => 'waitlisted',
                        'assigned_by' => 'system',
                        'assigned_by_user_id' => null,
                        'reason' => 'Rider suspended',
                    ]);
                $released = true;
            }

            $this->audit($admin, 'rider_profile', $profile->getKey(), $before, ['status' => $status]);

            return $profile;
        });

        if ($status === 'active') {
            $this->assignApprovedRider($profile);
            $released = true;
        } elseif ($status === 'suspended') {
            $this->riderDispatch->forceOfflineForProfile($riderId, 'Rider suspended');
        }
        if ($released) {
            $this->recheckWaitlist();
        }

        return $profile->load(['user', 'location.parent.parent.parent', 'documents', 'preferredShifts', 'shiftAssignments.zone', 'shiftAssignments.shift']);
    }

    private function assignForShiftLocked(RiderProfile $profile, int $shiftId): RiderShiftAssignment
    {
        $assignment = $this->scheduling->assignments()
            ->where('rider_id', $profile->getKey())
            ->where('shift_id', $shiftId)
            ->lockForUpdate()
            ->first();
        $capacities = $this->scheduling->capacities()
            ->with('zone')
            ->where('shift_id', $shiftId)
            ->whereHas('zone', fn ($query) => $query->where('is_active', true))
            ->orderBy('zone_id')
            ->lockForUpdate()
            ->get();

        if (! is_numeric($profile->home_lat) || ! is_numeric($profile->home_lng)) {
            return $this->waitlist($assignment, $profile, $shiftId, 'Home coordinates are required for zone assignment.');
        }

        $options = $capacities
            ->filter(fn ($capacity): bool => $capacity->zone !== null)
            ->map(fn ($capacity): array => [
                'capacity' => $capacity,
                'distance' => $this->distanceKm(
                    (float) $profile->home_lat,
                    (float) $profile->home_lng,
                    (float) $capacity->zone->center_lat,
                    (float) $capacity->zone->center_lng,
                ),
            ])
            ->filter(fn (array $candidate): bool => $candidate['distance'] <= $this->maxZoneDistanceKm())
            ->sort(function (array $left, array $right): int {
                $distanceOrder = $left['distance'] <=> $right['distance'];

                return $distanceOrder !== 0
                    ? $distanceOrder
                    : ((int) $left['capacity']->zone_id <=> (int) $right['capacity']->zone_id);
            });

        foreach ($options as $option) {
            $capacity = $option['capacity'];
            $used = $this->scheduling->assignments()
                ->where('zone_id', $capacity->zone_id)
                ->where('shift_id', $shiftId)
                ->where('status', 'assigned')
                ->lockForUpdate()
                ->pluck('id')
                ->reject(fn ($id): bool => $assignment !== null && (int) $id === (int) $assignment->getKey())
                ->count();

            if ($used < (int) $capacity->max_riders) {
                $assignment ??= new RiderShiftAssignment([
                    'rider_id' => $profile->getKey(),
                    'shift_id' => $shiftId,
                ]);
                $assignment->forceFill([
                    'zone_id' => $capacity->zone_id,
                    'status' => 'assigned',
                    'assigned_by' => 'system',
                    'assigned_by_user_id' => null,
                    'reason' => null,
                ])->save();

                return $assignment;
            }
        }

        return $this->waitlist(
            $assignment,
            $profile,
            $shiftId,
            $options->isEmpty()
                ? 'No active zone with capacity is within the allowed distance.'
                : 'All eligible zones are at capacity.',
        );
    }

    private function waitlist(
        ?RiderShiftAssignment $assignment,
        RiderProfile $profile,
        int $shiftId,
        string $reason,
    ): RiderShiftAssignment {
        $assignment ??= new RiderShiftAssignment([
            'rider_id' => $profile->getKey(),
            'shift_id' => $shiftId,
        ]);
        $assignment->forceFill([
            'zone_id' => null,
            'status' => 'waitlisted',
            'assigned_by' => 'system',
            'assigned_by_user_id' => null,
            'reason' => $reason,
        ])->save();

        return $assignment;
    }

    private function lockCapacity(int $zoneId, int $shiftId): void
    {
        $this->scheduling->capacities()
            ->where('zone_id', $zoneId)
            ->where('shift_id', $shiftId)
            ->lockForUpdate()
            ->first();
    }

    private function assertEligible(RiderProfile $profile): void
    {
        abort_unless($this->isEligible($profile), 409, 'Rider must be approved and not suspended or resigned.');
    }

    private function isEligible(RiderProfile $profile): bool
    {
        return $profile->application_status === 'approved'
            && in_array($profile->status, ['pending_activation', 'active'], true);
    }

    private function maxZoneDistanceKm(): float
    {
        $raw = $this->settings->all()['max_zone_distance_km'] ?? 10;
        $value = is_numeric($raw) ? (float) $raw : 10.0;

        return $value > 0 ? $value : 10.0;
    }

    private function distanceKm(float $latitudeA, float $longitudeA, float $latitudeB, float $longitudeB): float
    {
        $latitudeDelta = deg2rad($latitudeB - $latitudeA);
        $longitudeDelta = deg2rad($longitudeB - $longitudeA);
        $a = sin($latitudeDelta / 2) ** 2
            + cos(deg2rad($latitudeA)) * cos(deg2rad($latitudeB)) * sin($longitudeDelta / 2) ** 2;

        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function zoneAttributes(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'psgc_code',
            'name',
            'center_lat',
            'center_lng',
            'radius_km',
            'is_active',
        ]));
    }

    private function releaseZoneAssignments(Zone $zone, string $reason): void
    {
        $zone->assignments()
            ->where('status', 'assigned')
            ->update([
                'zone_id' => null,
                'status' => 'waitlisted',
                'assigned_by' => 'system',
                'assigned_by_user_id' => null,
                'reason' => $reason,
            ]);
    }

    private function zoneSnapshot(Zone $zone): array
    {
        return [
            'name' => $zone->name,
            'psgc_code' => $zone->psgc_code,
            'center_lat' => $zone->center_lat,
            'center_lng' => $zone->center_lng,
            'radius_km' => $zone->radius_km,
            'is_active' => (bool) $zone->is_active,
        ];
    }

    private function assignmentSnapshot(RiderShiftAssignment $assignment): array
    {
        return [
            'rider_id' => $assignment->rider_id,
            'zone_id' => $assignment->zone_id,
            'shift_id' => $assignment->shift_id,
            'status' => $assignment->status,
            'assigned_by' => $assignment->assigned_by,
            'reason' => $assignment->reason,
        ];
    }

    private function audit(User $admin, string $entityType, int|string $entityId, ?array $before, array $after): void
    {
        AuditLog::query()->create([
            'actor_user_id' => $admin->getKey(),
            'action' => 'rider_scheduling_updated',
            'entity_type' => $entityType,
            'entity_id' => (string) $entityId,
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }
}
