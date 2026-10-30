<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('salo:expire-team-invitations')->everyFifteenMinutes();
Schedule::command('salo:prune-audit-logs')->daily();
Schedule::command('salo:reset-menu-quantities')->everyMinute()->onOneServer()->withoutOverlapping(1);
Schedule::command('salo:cancel-unanswered-orders')->everyMinute()->onOneServer()->withoutOverlapping(1);
