<?php

namespace App\Repositories\Database;

use App\Models\PsgcLocation;
use App\Models\RiderDocument;
use App\Models\RiderProfile;
use App\Models\Shift;
use App\Repositories\Contracts\RiderApplicationRepository;
use Illuminate\Database\Eloquent\Builder;

class DatabaseRiderApplicationRepository implements RiderApplicationRepository
{
    public function profiles(): Builder
    {
        return RiderProfile::query();
    }

    public function documents(): Builder
    {
        return RiderDocument::query();
    }

    public function locations(): Builder
    {
        return PsgcLocation::query();
    }

    public function shifts(): Builder
    {
        return Shift::query();
    }
}
