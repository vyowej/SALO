<?php

namespace App\Repositories\Contracts;

use Illuminate\Database\Eloquent\Builder;

interface RiderApplicationRepository
{
    public function profiles(): Builder;

    public function documents(): Builder;

    public function locations(): Builder;

    public function shifts(): Builder;
}
