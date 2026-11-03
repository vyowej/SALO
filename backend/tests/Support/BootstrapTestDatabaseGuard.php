<?php

declare(strict_types=1);

namespace Tests\Support;

use Dotenv\Dotenv;
use PDO;
use RuntimeException;

final class BootstrapTestDatabaseGuard
{
    public static function assertSafe(string $environmentFile): void
    {
        $contents = file_get_contents($environmentFile);
        if ($contents === false) {
            throw new RuntimeException('Unable to read the test environment file.');
        }

        $fileEnvironment = Dotenv::parse($contents);
        $environment = self::processEnvironment('APP_ENV');
        $connection = self::processEnvironment('DB_CONNECTION');
        $database = self::processEnvironment('DB_DATABASE');

        if ($environment !== 'testing'
            || ($fileEnvironment['APP_ENV'] ?? null) !== 'testing'
            || ! in_array($connection, ['mysql', 'mariadb'], true)
            || ($fileEnvironment['DB_CONNECTION'] ?? null) !== $connection
            || ! self::isTestDatabase($database)
            || ($fileEnvironment['DB_DATABASE'] ?? null) !== $database) {
            throw new RuntimeException(
                'Refusing to run tests: APP_ENV and DB_CONNECTION must be testing and MySQL/MariaDB, and DB_DATABASE must match .env.testing and end in _test.'
            );
        }

        foreach (['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD'] as $name) {
            if (! array_key_exists($name, $fileEnvironment)) {
                throw new RuntimeException('The test environment file is missing '.$name.'.');
            }
        }

        $host = (string) $fileEnvironment['DB_HOST'];
        $port = (string) $fileEnvironment['DB_PORT'];
        $username = (string) $fileEnvironment['DB_USERNAME'];
        $password = (string) $fileEnvironment['DB_PASSWORD'];
        $socket = (string) ($fileEnvironment['DB_SOCKET'] ?? '');
        $dsn = $socket !== ''
            ? 'mysql:unix_socket='.$socket.';dbname='.$database.';charset=utf8mb4'
            : 'mysql:host='.$host.';port='.$port.';dbname='.$database.';charset=utf8mb4';

        $pdo = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $selectedDatabase = $pdo->query('SELECT DATABASE()')->fetchColumn();

        if (! self::isTestDatabase($selectedDatabase)
            || $selectedDatabase !== $database) {
            throw new RuntimeException(
                'Refusing to run tests: SELECT DATABASE() must match DB_DATABASE and end in _test.'
            );
        }
    }

    private static function processEnvironment(string $name): ?string
    {
        foreach ([$_ENV[$name] ?? null, $_SERVER[$name] ?? null, getenv($name)] as $value) {
            if (is_string($value) && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    private static function isTestDatabase(mixed $database): bool
    {
        return is_string($database)
            && strcasecmp($database, 'salo') !== 0
            && preg_match('/_test$/iD', $database) === 1;
    }
}
