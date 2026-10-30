<?php

namespace App\Console\Commands;

use App\Services\AuditRetentionService;
use Illuminate\Console\Command;

class PruneAuditLogs extends Command
{
    protected $signature = 'salo:prune-audit-logs';

    protected $description = 'Remove audit history older than the 90-day retention period';

    public function handle(AuditRetentionService $service): int
    {
        $count = $service->prune();
        $this->info("Pruned {$count} audit records.");

        return self::SUCCESS;
    }
}
