<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class LoadTestSchema extends Command
{
    private const TEST_DATABASE = 'salo_test';

    private const EXPECTED_TABLES = [
        'users',
        'platform_admins',
        'auth_tokens',
        'psgc_locations',
        'platform_settings',
        'cuisine_types',
        'restaurants',
        'audit_logs',
        'notifications',
        'restaurant_applications',
        'application_documents',
        'restaurant_photos',
        'restaurant_staff',
        'invitations',
        'restaurant_cuisines',
        'operating_hours',
        'closure_dates',
        'reservation_settings',
        'menu_categories',
        'menu_items',
        'dietary_tags',
        'menu_item_dietary_tags',
        'user_addresses',
        'carts',
        'cart_items',
        'checkout_groups',
        'orders',
        'order_items',
        'order_status_histories',
        'payments',
        'discounts',
        'discount_redemptions',
        'restaurant_tables',
        'reservations',
        'restaurant_reviews',
        'favorite_restaurants',
        'favorite_menu_items',
        'support_tickets',
        'ticket_messages',
        'zones',
        'shifts',
        'zone_shift_capacities',
        'rider_profiles',
        'rider_documents',
        'rider_preferred_shifts',
        'rider_shift_assignments',
        'deliveries',
        'delivery_offers',
        'rider_reviews',
        'co_owner_requests',
    ];

    protected $signature = 'salo:test-schema-load
        {--dry-run : Print the allowlisted statements without executing them}
        {--apply : Apply the allowlisted statements after confirmation}';

    protected $description = 'Load the authoritative schema into an empty guarded test database';

    public function handle(): int
    {
        if ($this->option('dry-run') === $this->option('apply')) {
            $this->error('Specify exactly one of --dry-run or --apply.');

            return self::FAILURE;
        }

        if (app()->environment() !== 'testing') {
            $this->error('Refusing to load a schema unless APP_ENV=testing.');

            return self::FAILURE;
        }

        $connectionName = (string) config('database.default');
        $databaseConfig = config("database.connections.{$connectionName}");
        $driver = $databaseConfig['driver'] ?? null;
        $environmentConnection = (string) env('DB_CONNECTION', '');
        $environmentDatabase = trim((string) env('DB_DATABASE', ''));
        $configuredDatabase = trim((string) ($databaseConfig['database'] ?? ''));

        if (! in_array($driver, ['mysql', 'mariadb'], true)
            || $environmentConnection !== $connectionName
            || strcasecmp($environmentDatabase, self::TEST_DATABASE) !== 0
            || ! $this->isTestDatabase($environmentDatabase)
            || ! $this->isTestDatabase($configuredDatabase)
            || $environmentDatabase !== $configuredDatabase) {
            $this->error('Refusing unsafe database configuration. DB_CONNECTION must be MySQL/MariaDB and DB_DATABASE must match a database ending in _test.');

            return self::FAILURE;
        }

        try {
            $statements = $this->loadAllowlistedStatements();
        } catch (Throwable $exception) {
            $this->error('Could not prepare the allowlisted schema statements: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info('Allowlisted statements ('.count($statements).'):');
        foreach ($statements as $index => $statement) {
            $this->line(sprintf('%02d. %s %s', $index + 1, $statement['kind'], $statement['table']));
        }
        $this->line('Skipped: DROP DATABASE, CREATE DATABASE, USE, and SET statements.');

        try {
            $connection = DB::connection($connectionName);
            $selectedDatabase = $connection->selectOne('SELECT DATABASE() AS selected_database')?->selected_database;

            if (! is_string($selectedDatabase)
                || strcasecmp($selectedDatabase, self::TEST_DATABASE) !== 0
                || ! $this->isTestDatabase($selectedDatabase)
                || $selectedDatabase !== $environmentDatabase
                || $selectedDatabase !== $configuredDatabase) {
                $this->error('Refusing: DB_DATABASE, configured database, and SELECT DATABASE() must be the same database ending in _test.');

                return self::FAILURE;
            }

            $existingTables = $connection->select('SHOW FULL TABLES');
            if ($existingTables !== []) {
                $this->error('Refusing: the selected test database is not empty. No SQL statements were executed.');

                return self::FAILURE;
            }
        } catch (Throwable) {
            $this->error('Read-only test database preflight failed. No SQL statements were executed; check the test database connection.');

            return self::FAILURE;
        }

        $this->info("Preflight passed: DB_DATABASE and SELECT DATABASE() are {$environmentDatabase}; the database is empty.");

        if ($this->option('dry-run')) {
            $this->info('Dry run complete. No SQL statements were executed.');

            return self::SUCCESS;
        }

        if (! $this->confirm("Apply these statements to the empty test database {$environmentDatabase}?")) {
            $this->warn('Cancelled. No SQL statements were executed.');

            return self::SUCCESS;
        }

        try {
            foreach ($statements as $statement) {
                DB::connection($connectionName)->unprepared($statement['sql']);
            }
        } catch (Throwable $exception) {
            $this->error('Schema loading stopped after a statement failed: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->info('The allowlisted schema and seed statements were applied to the test database.');

        return self::SUCCESS;
    }

    private function isTestDatabase(string $database): bool
    {
        return strcasecmp($database, 'salo') !== 0
            && str_ends_with(strtolower($database), '_test');
    }

    /**
     * @return list<array{kind: string, table: string, sql: string}>
     */
    private function loadAllowlistedStatements(): array
    {
        $path = dirname(base_path()).DIRECTORY_SEPARATOR.'database'
            .DIRECTORY_SEPARATOR.'salo_db.sql';
        $sql = file_get_contents($path);

        if ($sql === false) {
            throw new RuntimeException('The root database/salo_db.sql file could not be read.');
        }

        $statements = [];
        $tables = [];
        $seedTables = [];

        foreach ($this->splitStatements($sql) as $statement) {
            if (preg_match('/^\s*CREATE\s+TABLE\b/i', $statement) === 1) {
                if (preg_match('/^\s*CREATE\s+TABLE\s+`?([a-z0-9_]+)`?\s*\(/i', $statement, $match) !== 1) {
                    throw new RuntimeException('An unsupported CREATE TABLE statement was found.');
                }

                $table = strtolower($match[1]);
                if (in_array($table, $tables, true)) {
                    throw new RuntimeException("Duplicate CREATE TABLE statement for {$table}.");
                }
                $tables[] = $table;
                $statements[] = ['kind' => 'CREATE TABLE', 'table' => $table, 'sql' => $statement];

                continue;
            }

            if (preg_match('/^\s*INSERT\s+INTO\s+`?(platform_settings|shifts)`?\s*\(/i', $statement, $match) === 1) {
                $table = strtolower($match[1]);
                if (in_array($table, $seedTables, true)) {
                    throw new RuntimeException("Duplicate seed INSERT for {$table}.");
                }
                $seedTables[] = $table;
                $statements[] = ['kind' => 'INSERT INTO', 'table' => $table, 'sql' => $statement];

                continue;
            }

            if (preg_match('/^\s*(DROP\s+DATABASE|CREATE\s+DATABASE|USE|SET)\b/i', $statement) === 1) {
                continue;
            }

            throw new RuntimeException('An unexpected SQL statement was found; refusing to load it.');
        }

        if ($tables !== self::EXPECTED_TABLES) {
            throw new RuntimeException('The CREATE TABLE list differs from the reviewed root-schema allowlist.');
        }
        if ($seedTables !== ['platform_settings', 'shifts']) {
            throw new RuntimeException('Expected exactly the platform_settings and shifts seed INSERTs.');
        }

        return $statements;
    }

    /**
     * Split ordinary SQL statements while ignoring semicolons in strings and
     * removing comments, so commented-out SQL cannot enter the allowlist.
     *
     * @return list<string>
     */
    private function splitStatements(string $sql): array
    {
        $statements = [];
        $statement = '';
        $quote = null;
        $lineComment = false;
        $blockComment = false;
        $length = strlen($sql);

        for ($index = 0; $index < $length; $index++) {
            $character = $sql[$index];
            $next = $sql[$index + 1] ?? '';

            if ($lineComment) {
                if ($character === "\n") {
                    $lineComment = false;
                    $statement .= "\n";
                }

                continue;
            }

            if ($blockComment) {
                if ($character === '*' && $next === '/') {
                    $blockComment = false;
                    $index++;
                    $statement .= ' ';
                }

                continue;
            }

            if ($quote !== null) {
                $statement .= $character;
                if ($character === '\\' && $quote !== '`' && $index + 1 < $length) {
                    $statement .= $sql[++$index];
                } elseif ($character === $quote) {
                    if ($next === $quote) {
                        $statement .= $sql[++$index];
                    } else {
                        $quote = null;
                    }
                }

                continue;
            }

            if ($character === "'" || $character === '"' || $character === '`') {
                $quote = $character;
                $statement .= $character;

                continue;
            }

            if ($character === '/' && $next === '*') {
                $blockComment = true;
                $index++;
                $statement .= ' ';

                continue;
            }

            if ($character === '#'
                || ($character === '-' && $next === '-' && ctype_space($sql[$index + 2] ?? ' '))) {
                $lineComment = true;
                if ($character === '-') {
                    $index++;
                }
                $statement .= ' ';

                continue;
            }

            if ($character === ';') {
                $trimmed = trim($statement);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $statement = '';

                continue;
            }

            $statement .= $character;
        }

        if ($quote !== null || $blockComment) {
            throw new RuntimeException('The schema SQL contains an unterminated quote or block comment.');
        }

        $trimmed = trim($statement);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }
}
