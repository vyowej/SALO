<?php

namespace App\Console\Commands;

use App\Services\RiderDispatchService;
use Illuminate\Console\Command;

class DispatchReadyDeliveries extends Command
{
    protected $signature = 'salo:dispatch-ready-deliveries';

    protected $description = 'Expire rider offers and dispatch eligible ready delivery orders';

    public function handle(RiderDispatchService $dispatch): int
    {
        $expired = $dispatch->expireOffers();
        $stale = $dispatch->expireStaleLocations();
        $orders = $dispatch->dispatchReadyOrders();
        $this->info("Expired {$expired} offer(s), offlined {$stale} rider(s), checked {$orders} ready order(s).");

        return self::SUCCESS;
    }
}
