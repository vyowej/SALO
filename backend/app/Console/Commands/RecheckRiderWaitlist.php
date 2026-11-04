<?php

namespace App\Console\Commands;

use App\Services\RiderSchedulingService;
use Illuminate\Console\Command;

class RecheckRiderWaitlist extends Command
{
    protected $signature = 'salo:recheck-rider-waitlist';

    protected $description = 'Assign eligible waitlisted riders to newly available zone and shift capacity';

    public function handle(RiderSchedulingService $service): int
    {
        $assigned = $service->recheckWaitlist();
        $this->info("Assigned {$assigned} waitlisted rider shift(s).");

        return self::SUCCESS;
    }
}
