<?php

use App\Services\RiderDispatchService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\Support\GuardTestDatabase;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
GuardTestDatabase::assertSafe();

$orderId = (int) ($argv[1] ?? 0);
$riderId = (int) ($argv[2] ?? 0);
$readyPath = (string) ($argv[3] ?? '');
$barrierPath = (string) ($argv[4] ?? '');
$locationKey = "rider:{$riderId}:dispatch-location";
Cache::put($locationKey, [
    'latitude' => 14.6,
    'longitude' => 121.0,
    'updated_at' => now()->toIso8601String(),
], now()->addMinutes(2));

file_put_contents($readyPath, 'ready');
$deadline = microtime(true) + 30;
while (! is_file($barrierPath)) {
    if (microtime(true) >= $deadline) {
        fwrite(STDERR, "Timed out waiting for the concurrent dispatch barrier.\n");
        exit(3);
    }
    usleep(1000);
}

app(RiderDispatchService::class)->dispatchReadyOrder($orderId);
echo (string) DB::table('deliveries')->where('order_id', $orderId)->value('rider_id');
