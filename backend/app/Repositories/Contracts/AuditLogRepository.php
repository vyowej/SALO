<?php

namespace App\Repositories\Contracts;

use App\Models\AuditLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

interface AuditLogRepository
{
    public function record(array $attributes): AuditLog;

    public function paginateForRestaurant(int $restaurantId, array $filters): LengthAwarePaginator;

    public function pruneBefore(Carbon $cutoff): int;
}
