<?php

use App\Services\RiderSchedulingService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$riderId = (int) ($argv[1] ?? 0);
$shiftId = (int) ($argv[2] ?? 0);
$readyPath = (string) ($argv[3] ?? '');
$barrierPath = (string) ($argv[4] ?? '');
$connectionName = (string) config('database.default');
$connectionConfig = config("database.connections.{$connectionName}");

if (app()->environment() !== 'testing'
    || ($connectionConfig['database'] ?? null) !== 'salo_test'
    || env('DB_DATABASE') !== 'salo_test'
    || DB::connection($connectionName)->selectOne('SELECT DATABASE() AS selected_database')?->selected_database !== 'salo_test') {
    fwrite(STDERR, "Refusing worker connection outside guarded salo_test.\n");
    exit(2);
}

file_put_contents($readyPath, 'ready');
$deadline = microtime(true) + 30;
while (! is_file($barrierPath)) {
    if (microtime(true) >= $deadline) {
        fwrite(STDERR, "Timed out waiting for the concurrent test barrier.\n");
        exit(3);
    }
    usleep(1000);
}

$assignment = app(RiderSchedulingService::class)->assignRiderForShift($riderId, $shiftId);
echo $assignment->status;
