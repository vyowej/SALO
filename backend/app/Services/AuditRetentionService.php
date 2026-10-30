<?php

namespace App\Services;

use App\Repositories\Contracts\AuditLogRepository;

class AuditRetentionService
{
    public function __construct(private readonly AuditLogRepository $audit) {}

    public function prune(): int
    {
        return $this->audit->pruneBefore(now()->subDays(90));
    }
}
