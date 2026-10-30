<?php

namespace App\Repositories\Database;

use App\Models\AuditLog;
use App\Repositories\Contracts\AuditLogRepository;

class DatabaseAuditLogRepository implements AuditLogRepository
{
    public function record(array $attributes): AuditLog
    {
        return AuditLog::query()->create($attributes);
    }
}
