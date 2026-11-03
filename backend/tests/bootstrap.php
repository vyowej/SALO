<?php

declare(strict_types=1);

use Tests\Support\BootstrapTestDatabaseGuard;
use Tests\Support\TestDdlGuard;

require __DIR__.'/../vendor/autoload.php';

TestDdlGuard::assertNoDdlCalls(__DIR__);
BootstrapTestDatabaseGuard::assertSafe(__DIR__.'/../.env.testing');
