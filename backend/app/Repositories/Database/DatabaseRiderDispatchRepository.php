<?php

namespace App\Repositories\Database;

use App\Models\Delivery;
use App\Models\DeliveryOffer;
use App\Models\Order;
use App\Models\RiderProfile;
use App\Models\RiderShiftAssignment;
use App\Models\Zone;
use App\Repositories\Contracts\RiderDispatchRepository;
use Illuminate\Database\Eloquent\Builder;

class DatabaseRiderDispatchRepository implements RiderDispatchRepository
{
    public function orders(): Builder
    {
        return Order::query();
    }

    public function deliveries(): Builder
    {
        return Delivery::query();
    }

    public function offers(): Builder
    {
        return DeliveryOffer::query();
    }

    public function profiles(): Builder
    {
        return RiderProfile::query();
    }

    public function zones(): Builder
    {
        return Zone::query();
    }

    public function assignments(): Builder
    {
        return RiderShiftAssignment::query();
    }
}
