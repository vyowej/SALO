<?php

declare(strict_types=1);

namespace Tests\Support;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;

final class TestDdlGuard
{
    private const SCHEMA_METHODS = [
        'create',
        'table',
        'drop',
        'dropifexists',
        'dropalltables',
        'rename',
        'renamecolumn',
        'dropcolumn',
        'dropindex',
        'dropunique',
        'dropforeign',
        'dropprimary',
        'dropfulltext',
        'dropspatialindex',
        'disableforeignkeyconstraints',
        'enableforeignkeyconstraints',
    ];

    private const SQL_METHODS = ['statement', 'unprepared', 'truncate'];

    public static function assertNoDdlCalls(string $directory): void
    {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($files as $file) {
            if (! $file instanceof SplFileInfo || ! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }

            $source = file_get_contents($file->getPathname());
            if ($source === false) {
                throw new RuntimeException('Unable to inspect test source file: '.$file->getPathname());
            }

            self::assertSourceHasNoDdl($source, $file->getPathname());
        }
    }

    private static function assertSourceHasNoDdl(string $source, string $path): void
    {
        $tokens = array_values(array_filter(
            token_get_all($source),
            static fn (array|string $token): bool => ! is_array($token)
                || ! in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)
        ));

        foreach ($tokens as $index => $token) {
            if (! is_array($token) || $token[0] !== T_STRING) {
                continue;
            }

            $method = strtolower($token[1]);
            if (! in_array($method, self::SCHEMA_METHODS, true)
                && ! in_array($method, self::SQL_METHODS, true)) {
                continue;
            }

            if (($tokens[$index + 1] ?? null) !== '(') {
                continue;
            }

            $previous = $tokens[$index - 1] ?? null;
            $isObjectMethod = is_array($previous) && $previous[0] === T_OBJECT_OPERATOR;

            if (($method === 'truncate' && $isObjectMethod)
                || (in_array($method, self::SCHEMA_METHODS, true)
                    && self::hasFacadeInCurrentExpression($tokens, $index, 'schema'))) {
                throw new RuntimeException(sprintf(
                    'Test DDL call found at %s:%d.',
                    $path,
                    $token[2]
                ));
            }

            if (in_array($method, ['statement', 'unprepared'], true)
                && self::hasFacadeInCurrentExpression($tokens, $index, 'db')
                && self::sqlArgumentsContainDdl($tokens, $index + 1)) {
                throw new RuntimeException(sprintf(
                    'Test SQL DDL call found at %s:%d.',
                    $path,
                    $token[2]
                ));
            }
        }
    }

    private static function hasFacadeInCurrentExpression(array $tokens, int $index, string $facade): bool
    {
        for ($cursor = $index - 1, $checked = 0; $cursor >= 0 && $checked < 100; $cursor--, $checked++) {
            $token = $tokens[$cursor];
            if (in_array($token, [';', '{', '}', ','], true)) {
                return false;
            }

            if (! is_array($token) || ! in_array($token[0], [T_STRING, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED], true)) {
                continue;
            }

            $name = strtolower(ltrim($token[1], '\\'));
            if ($name === $facade || str_ends_with($name, '\\'.$facade)) {
                return true;
            }
        }

        return false;
    }

    private static function sqlArgumentsContainDdl(array $tokens, int $openParenthesis): bool
    {
        $depth = 0;
        $arguments = '';

        for ($index = $openParenthesis; $index < count($tokens); $index++) {
            $token = $tokens[$index];
            $value = is_array($token) ? $token[1] : $token;

            if ($value === '(') {
                $depth++;
            } elseif ($value === ')') {
                $depth--;
                if ($depth === 0) {
                    break;
                }
            }

            if (is_array($token) && $token[0] === T_CONSTANT_ENCAPSED_STRING) {
                $arguments .= substr($value, 1, -1).' ';
            } elseif (is_array($token) && $token[0] === T_ENCAPSED_AND_WHITESPACE) {
                $arguments .= $value.' ';
            }
        }

        return preg_match('/\b(?:CREATE|ALTER|DROP|TRUNCATE|RENAME)\b/i', $arguments) === 1;
    }
}
