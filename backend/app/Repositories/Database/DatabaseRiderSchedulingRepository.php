<?php

namespace App\Repositories\Database;

use App\Models\RiderProfile;
use App\Models\RiderShiftAssignment;
use App\Models\Shift;
use App\Models\Zone;
use App\Models\ZoneShiftCapacity;
use App\Repositories\Contracts\RiderSchedulingRepository;
use Illuminate\Database\Eloquent\Builder;

class DatabaseRiderSchedulingRepository implements RiderSchedulingRepository
{
    public function zones(): Builder
    {
        return Zone::query();
    }

    public function shifts(): Builder
    {
        return Shift::query();
    }

    public function capacities(): Builder
    {
        return ZoneShiftCapacity::query();
    }

    public function assignments(): Builder
    {
        return RiderShiftAssignment::query();
    }

    public function profiles(): Builder
    {
        return RiderProfile::query();
    }
}
