<?php

namespace App\Repositories\Contracts;

use Illuminate\Database\Eloquent\Builder;

interface RiderDispatchRepository
{
    public function orders(): Builder;

    public function deliveries(): Builder;

    public function offers(): Builder;

    public function profiles(): Builder;

    public function zones(): Builder;

    public function assignments(): Builder;
}
