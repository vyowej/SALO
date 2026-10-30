<?php

namespace App\Repositories\Contracts;

use App\Models\AuditLog;

interface AuditLogRepository
{
    public function record(array $attributes): AuditLog;
}
