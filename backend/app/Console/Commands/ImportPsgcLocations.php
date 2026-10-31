<?php

namespace App\Console\Commands;

use App\Services\PsgcImportService;
use Illuminate\Console\Command;

class ImportPsgcLocations extends Command
{
    protected $signature = 'psgc:import {source? : Path to a normalized PSGC CSV file or cached API directory} {--confirm : Confirm writes to the configured database}';

    protected $description = 'Validate and import a local PSGC CSV export or cached API datasets';

    public function handle(PsgcImportService $service): int
    {
        if (! $this->option('confirm')) {
            $this->error('Import not started. Review the selected database and re-run with --confirm to write PSGC rows.');

            return self::FAILURE;
        }

        $source = $this->argument('source') ?: storage_path('app/psgc-cache');
        if (! str_starts_with($source, DIRECTORY_SEPARATOR)
            && preg_match('/^[A-Za-z]:[\\\\\/]/', $source) !== 1) {
            $source = base_path($source);
        }

        $count = $service->importSource($source);
        $this->info("Imported or updated {$count} PSGC locations.");

        return self::SUCCESS;
    }
}
