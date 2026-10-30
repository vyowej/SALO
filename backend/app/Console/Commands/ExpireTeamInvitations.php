<?php

namespace App\Console\Commands;

use App\Services\TeamService;
use Illuminate\Console\Command;

class ExpireTeamInvitations extends Command
{
    protected $signature = 'salo:expire-team-invitations';

    protected $description = 'Expire unused restaurant team invitations and remove their pending memberships';

    public function handle(TeamService $service): int
    {
        $count = $service->expireDueInvitations();
        $this->info("Expired {$count} team invitations.");

        return self::SUCCESS;
    }
}
