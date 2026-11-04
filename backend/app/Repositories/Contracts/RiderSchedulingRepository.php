<?php

namespace App\Repositories\Contracts;

use Illuminate\Database\Eloquent\Builder;

interface RiderSchedulingRepository
{
    public function zones(): Builder;

    public function shifts(): Builder;

    public function capacities(): Builder;

    public function assignments(): Builder;

    public function profiles(): Builder;
}
