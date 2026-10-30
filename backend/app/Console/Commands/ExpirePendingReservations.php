<?php

namespace App\Console\Commands;

use App\Services\BusinessReservationService;
use Illuminate\Console\Command;

class ExpirePendingReservations extends Command
{
    protected $signature = 'salo:expire-pending-reservations';

    protected $description = 'Release expired pending restaurant reservation holds';

    public function handle(BusinessReservationService $reservations): int
    {
        $count = $reservations->expirePending();
        $this->info("Expired {$count} pending reservation(s).");

        return self::SUCCESS;
    }
}
