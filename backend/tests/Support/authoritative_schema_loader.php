<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->loadEnvironmentFrom('.env.testing');
$app->make(Kernel::class)->bootstrap();

final class AuthoritativeSchemaDryRun
{
    private const EXPECTED_TABLE_COUNT = 50;

    private const APPROVED_SEED_TABLES = [
        'platform_settings',
        'shifts',
    ];

    public function run(array $arguments): void
    {
        if ($arguments !== ['--dry-run']) {
            throw new RuntimeException('Only --dry-run is supported; this loader cannot execute SQL.');
        }

        $connectionName = (string) config('database.default');
        $connectionConfig = config("database.connections.{$connectionName}");
        $configuredDatabase = $connectionConfig['database'] ?? null;

        if (! in_array($connectionConfig['driver'] ?? null, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('The schema dry run requires a MySQL or MariaDB connection.');
        }

        if (! is_string($configuredDatabase) || ! $this->isSafeTestDatabase($configuredDatabase)) {
            throw new RuntimeException('Configured DB_DATABASE must end in _test and must not be salo.');
        }

        $connection = DB::connection($connectionName);
        $identity = $connection->selectOne('SELECT DATABASE() AS database_name, VERSION() AS server_version');
        $actualDatabase = $identity->database_name ?? null;

        if (! is_string($actualDatabase)
            || ! $this->isSafeTestDatabase($actualDatabase)
            || $actualDatabase !== $configuredDatabase
            || $actualDatabase === 'salo') {
            throw new RuntimeException('Connected database failed the _test name and configured-name safety checks.');
        }

        $objects = $this->databaseObjects($connection, $actualDatabase);
        $empty = array_sum($objects) === 0;

        if (! $empty) {
            throw new RuntimeException(
                'Refusing to load into a non-empty or partially initialized database. Object counts: '
                .json_encode($objects, JSON_THROW_ON_ERROR)
            );
        }

        $schemaPath = dirname(__DIR__, 3).'/database/salo_db.sql';
        $schema = file_get_contents($schemaPath);

        if ($schema === false) {
            throw new RuntimeException("Unable to read authoritative schema: {$schemaPath}");
        }

        $statements = $this->splitStatements($schema);
        [$selected, $skipped, $tableNames, $seedCounts] = $this->selectApprovedStatements($statements);

        if (count($tableNames) !== self::EXPECTED_TABLE_COUNT
            || count(array_unique($tableNames)) !== self::EXPECTED_TABLE_COUNT) {
            throw new RuntimeException('Expected exactly 50 uniquely named CREATE TABLE statements.');
        }

        if ($seedCounts !== ['platform_settings' => 1, 'shifts' => 1]) {
            throw new RuntimeException('Expected one seed INSERT each for platform_settings and shifts.');
        }

        $this->printDryRun(
            $configuredDatabase,
            $actualDatabase,
            (string) $identity->server_version,
            $objects,
            $tableNames,
            $seedCounts,
            $selected,
            $skipped
        );
    }

    private function isSafeTestDatabase(string $database): bool
    {
        return $database !== 'salo' && preg_match('/_test$/D', $database) === 1;
    }

    private function databaseObjects($connection, string $database): array
    {
        return [
            'tables_and_views' => (int) $connection->selectOne(
                'SELECT COUNT(*) AS object_count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
                [$database]
            )->object_count,
            'routines' => (int) $connection->selectOne(
                'SELECT COUNT(*) AS object_count FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?',
                [$database]
            )->object_count,
            'triggers' => (int) $connection->selectOne(
                'SELECT COUNT(*) AS object_count FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?',
                [$database]
            )->object_count,
            'events' => (int) $connection->selectOne(
                'SELECT COUNT(*) AS object_count FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?',
                [$database]
            )->object_count,
        ];
    }

    private function splitStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
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
                    $buffer .= "\n";
                }

                continue;
            }

            if ($blockComment) {
                if ($character === '*' && $next === '/') {
                    $blockComment = false;
                    $index++;
                    $buffer .= ' ';
                }

                continue;
            }

            if ($quote !== null) {
                $buffer .= $character;

                if ($character === '\\' && $quote !== '`' && $next !== '') {
                    $buffer .= $next;
                    $index++;
                } elseif ($character === $quote) {
                    if ($next === $quote && $quote !== '`') {
                        $buffer .= $next;
                        $index++;
                    } else {
                        $quote = null;
                    }
                }

                continue;
            }

            if ($character === "'" || $character === '"' || $character === '`') {
                $quote = $character;
                $buffer .= $character;
                continue;
            }

            if ($character === '#' || ($character === '-' && $next === '-' && preg_match('/\s/', $sql[$index + 2] ?? '') === 1)) {
                $lineComment = true;
                $index += $character === '#' ? 0 : 1;
                continue;
            }

            if ($character === '/' && $next === '*') {
                if (($sql[$index + 2] ?? '') === '!') {
                    throw new RuntimeException('Executable version comments are not allowed in the schema source.');
                }

                $blockComment = true;
                $index++;
                continue;
            }

            if ($character === ';') {
                $statement = trim($buffer);

                if ($statement !== '') {
                    $statements[] = $statement;
                }

                $buffer = '';
                continue;
            }

            $buffer .= $character;
        }

        if ($quote !== null || $blockComment) {
            throw new RuntimeException('Unterminated quote or SQL comment in schema source.');
        }

        $statement = trim($buffer);

        if ($statement !== '') {
            $statements[] = $statement;
        }

        return $statements;
    }

    private function selectApprovedStatements(array $statements): array
    {
        $selected = [];
        $skipped = [];
        $tableNames = [];
        $seedCounts = ['platform_settings' => 0, 'shifts' => 0];

        foreach ($statements as $statement) {
            if (preg_match('/^CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i', $statement, $match) === 1) {
                $tableNames[] = $match[1];
                $selected[] = $statement;
                continue;
            }

            if (preg_match('/^INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?/i', $statement, $match) === 1
                && in_array($match[1], self::APPROVED_SEED_TABLES, true)) {
                $seedCounts[$match[1]]++;
                $selected[] = $statement;
                continue;
            }

            $skipped[] = $statement;
        }

        return [$selected, $skipped, $tableNames, $seedCounts];
    }

    private function printDryRun(
        string $configuredDatabase,
        string $actualDatabase,
        string $serverVersion,
        array $objects,
        array $tableNames,
        array $seedCounts,
        array $selected,
        array $skipped
    ): void {
        echo "Configured DB_DATABASE: {$configuredDatabase}\n";
        echo "SELECT DATABASE(): {$actualDatabase}\n";
        echo "Server version: {$serverVersion}\n";
        echo 'Configured and connected database match: YES'."\n";
        echo 'Database ends in _test and is not salo: YES'."\n";
        echo "Database object counts: ".json_encode($objects, JSON_THROW_ON_ERROR)."\n";
        echo "salo_test is completely empty: YES\n";
        echo 'CREATE TABLE statements selected: '.count($tableNames)."\n";
        echo 'Seed INSERT statements selected: '.array_sum($seedCounts)
            .' (platform_settings: '.$seedCounts['platform_settings']
            .', shifts: '.$seedCounts['shifts'].")\n";
        echo 'Total statements that would execute: '.count($selected)."\n";
        echo "Safety checks: PASSED\n";
        echo "Execution status: NOT EXECUTED (dry run only)\n";
        echo "\nEXACT SELECTED SQL (ordered as in database/salo_db.sql)\n";

        foreach ($selected as $index => $statement) {
            echo "\n-- Statement ".($index + 1)." of ".count($selected)." --\n";
            echo $statement.";\n";
        }

        echo "\nSKIPPED STATEMENTS (not approved for execution)\n";

        foreach ($skipped as $index => $statement) {
            echo "\n-- Skipped ".($index + 1)." of ".count($skipped)." --\n";
            echo $statement.";\n";
        }

        echo "\nNo SQL statement was executed.\n";
    }
}

(new AuthoritativeSchemaDryRun())->run(array_slice($argv, 1));
