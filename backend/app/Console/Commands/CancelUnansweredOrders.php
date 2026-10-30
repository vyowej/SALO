<?php

namespace App\Console\Commands;

use App\Services\BusinessOrderService;
use Illuminate\Console\Command;

class CancelUnansweredOrders extends Command
{
    protected $signature = 'salo:cancel-unanswered-orders';

    protected $description = 'Cancel restaurant orders that have been unanswered for 10 minutes';

    public function handle(BusinessOrderService $orders): int
    {
        $count = $orders->autoCancelUnanswered();
        $this->info("Cancelled {$count} unanswered order(s).");

        return self::SUCCESS;
    }
}
