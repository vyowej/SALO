<?php

namespace App\Console\Commands;

use App\Services\PsgcImportService;
use Illuminate\Console\Command;

class ImportPsgcLocations extends Command
{
    protected $signature = 'psgc:import {file : Path to the official PSGC CSV export}';

    protected $description = 'Validate and import the official PSGC hierarchy';

    public function handle(PsgcImportService $service): int
    {
        $path = $this->argument('file');
        if (! is_file($path)) {
            $path = base_path($path);
        }

        $count = $service->importCsv($path);
        $this->info("Imported or updated {$count} PSGC locations.");

        return self::SUCCESS;
    }
}
