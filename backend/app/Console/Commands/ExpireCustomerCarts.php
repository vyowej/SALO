<?php

namespace App\Console\Commands;

use App\Services\CustomerCartService;
use Illuminate\Console\Command;

class ExpireCustomerCarts extends Command
{
    protected $signature = 'salo:expire-customer-carts';

    protected $description = 'Clear customer cart items after their inactivity expiry';

    public function handle(CustomerCartService $carts): int
    {
        $count = $carts->expireInactive();
        $this->info("Expired {$count} customer cart(s).");

        return self::SUCCESS;
    }
}
