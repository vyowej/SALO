<?php

namespace App\Console\Commands;

use App\Services\Contracts\LocationService;
use Illuminate\Console\Command;

class VerifyPsgcLocations extends Command
{
    protected $signature = 'psgc:verify';

    protected $description = 'Read-only counts and parent-hierarchy checks for imported PSGC locations';

    public function handle(LocationService $locations): int
    {
        $report = $locations->verificationReport();
        $this->info('PSGC rows by level:');
        foreach ($report['counts'] as $level => $count) {
            $this->line("  {$level}: {$count}");
        }

        $this->line('Rows with a missing parent: '.$report['missing_parent_count']);
        $this->line('Rows with a wrong parent level: '.$report['wrong_parent_count']);
        $this->line('Invalid-parent count: '.$report['invalid_parent_count']);

        return $report['invalid_parent_count'] === 0 ? self::SUCCESS : self::FAILURE;
    }
}
