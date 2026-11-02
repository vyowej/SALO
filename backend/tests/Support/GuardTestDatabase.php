<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;

final class GuardTestDatabase
{
    public static function assertSafe(): void
    {
        $connectionName = (string) config('database.default');
        $connectionConfig = config("database.connections.{$connectionName}");
        $driver = $connectionConfig['driver'] ?? null;
        $environmentDatabase = env('DB_DATABASE');
        $configuredDatabase = $connectionConfig['database'] ?? null;

        if (app()->environment() !== 'testing'
            || ! in_array($driver, ['mysql', 'mariadb'], true)
            || ! self::isTestDatabase($environmentDatabase)
            || ! self::isTestDatabase($configuredDatabase)
            || $environmentDatabase !== $configuredDatabase) {
            throw new RuntimeException(
                'Refusing to run tests: APP_ENV must be testing and DB_DATABASE must match a MySQL/MariaDB database ending in _test.'
            );
        }

        $selectedDatabase = DB::connection($connectionName)
            ->selectOne('SELECT DATABASE() AS selected_database')
            ?->selected_database;

        if (! self::isTestDatabase($selectedDatabase)
            || $selectedDatabase !== $environmentDatabase
            || $selectedDatabase !== $configuredDatabase) {
            throw new RuntimeException(
                'Refusing to run tests: SELECT DATABASE() must match DB_DATABASE and end in _test.'
            );
        }
    }

    private static function isTestDatabase(mixed $database): bool
    {
        return is_string($database)
            && strcasecmp($database, 'salo') !== 0
            && preg_match('/_test$/iD', $database) === 1;
    }
}
