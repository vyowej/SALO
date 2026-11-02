<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Tests\Support\GuardTestDatabase;
use Tests\Support\TestDdlGuard;

require __DIR__.'/../vendor/autoload.php';

TestDdlGuard::assertNoDdlCalls(__DIR__);

$app = require __DIR__.'/../bootstrap/app.php';
$app->loadEnvironmentFrom('.env.testing');
$app->make(Kernel::class)->bootstrap();

GuardTestDatabase::assertSafe();

DB::purge((string) config('database.default'));
