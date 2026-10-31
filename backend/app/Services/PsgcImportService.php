<?php

namespace App\Services;

use App\Repositories\Contracts\PsgcLocationRepository;

class PsgcImportService
{
    private const LEVEL_ORDER = [
        'region' => 1,
        'province' => 2,
        'city' => 3,
        'barangay' => 4,
    ];

    private const API_DATASETS = [
        'regions.json' => 'region',
        'provinces.json' => 'province',
        'cities-municipalities.json' => 'city',
        'barangays.json' => 'barangay',
    ];

    private const INDEPENDENT_CITY_CODES = ['097332000'];

    public function __construct(private readonly PsgcLocationRepository $locations) {}

    public function importSource(string $source): int
    {
        if (is_dir($source)) {
            return $this->importApiCache($source);
        }

        if (strtolower(pathinfo($source, PATHINFO_EXTENSION)) === 'csv') {
            return $this->importCsv($source);
        }

        throw new \InvalidArgumentException('The PSGC source must be a CSV file or a directory containing the cached API JSON files.');
    }

    public function importCsv(string $path): int
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new \InvalidArgumentException('The PSGC CSV file does not exist or cannot be read.');
        }

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new \RuntimeException('The PSGC CSV file could not be opened.');
        }

        $header = fgetcsv($handle);
        if (! is_array($header)) {
            fclose($handle);
            throw new \InvalidArgumentException('The PSGC CSV must have a header row.');
        }
        $header[0] = ltrim((string) $header[0], "\xEF\xBB\xBF");
        $header = array_map(fn ($column): string => strtolower(trim((string) $column)), $header);
        if ($header !== ['code', 'parent_code', 'name', 'level']) {
            fclose($handle);
            throw new \InvalidArgumentException('The PSGC CSV header must be code,parent_code,name,level.');
        }

        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            if ($row === [null] || count(array_filter($row, fn ($value): bool => trim((string) $value) !== '')) === 0) {
                continue;
            }
            if (count($row) !== count($header)) {
                fclose($handle);
                throw new \InvalidArgumentException('A PSGC CSV row has an unexpected number of columns.');
            }
            $rows[] = array_combine($header, array_map(fn ($value): string => trim((string) $value), $row));
        }
        fclose($handle);

        $this->validate($rows);
        $this->locations->upsert($rows);

        return count($rows);
    }

    public function importApiCache(string $directory): int
    {
        $datasets = [];
        foreach (self::API_DATASETS as $filename => $level) {
            $path = rtrim($directory, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.$filename;
            if (! is_file($path) || ! is_readable($path)) {
                throw new \InvalidArgumentException("The PSGC API cache is missing readable file {$filename}.");
            }

            try {
                $records = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $exception) {
                throw new \InvalidArgumentException("The PSGC API cache file {$filename} is not valid JSON.", previous: $exception);
            }

            if (! is_array($records) || ! array_is_list($records) || $records === []) {
                throw new \InvalidArgumentException("The PSGC API cache file {$filename} must contain a non-empty JSON array.");
            }
            foreach ($records as $record) {
                if (! is_array($record)) {
                    throw new \InvalidArgumentException("The PSGC API cache file {$filename} contains a non-object record.");
                }
            }

            $datasets[$level] = $records;
        }

        $rows = [];
        foreach ($datasets['region'] as $record) {
            $rows[] = $this->apiRow($record, 'region', null);
        }
        foreach ($datasets['province'] as $record) {
            $rows[] = $this->apiRow($record, 'province', $this->requiredCode($record, 'regionCode'));
        }
        foreach ($datasets['city'] as $record) {
            $code = $this->requiredCode($record, 'code');
            $provinceCode = $this->optionalCode($record['provinceCode'] ?? null);
            $regionCode = $this->requiredCode($record, 'regionCode');
            $parentCode = $provinceCode;

            if ($parentCode === null || in_array($code, self::INDEPENDENT_CITY_CODES, true)) {
                $parentCode = $regionCode;
            }

            $name = trim((string) ($record['name'] ?? ''));
            if ($code === '097332000' || strcasecmp($name, 'City of Zamboanga') === 0) {
                $name = 'Zamboanga City';
            }
            $rows[] = $this->apiRow($record, 'city', $parentCode, $name);
        }
        foreach ($datasets['barangay'] as $record) {
            $parentCode = $this->optionalCode($record['cityCode'] ?? null)
                ?? $this->optionalCode($record['municipalityCode'] ?? null);
            if ($parentCode === null) {
                throw new \InvalidArgumentException(
                    'A PSGC barangay has no cityCode or municipalityCode; refusing to attach it to a district or sub-municipality.'
                );
            }
            $rows[] = $this->apiRow($record, 'barangay', $parentCode);
        }

        $this->validate($rows);
        $this->locations->upsert($rows);

        return count($rows);
    }

    private function apiRow(array $record, string $level, ?string $parentCode, ?string $name = null): array
    {
        return [
            'code' => $this->requiredCode($record, 'code'),
            'parent_code' => $parentCode ?? '',
            'name' => $name ?? trim((string) ($record['name'] ?? '')),
            'level' => $level,
        ];
    }

    private function requiredCode(array $record, string $field): string
    {
        $code = $this->optionalCode($record[$field] ?? null);
        if ($code === null) {
            throw new \InvalidArgumentException("A PSGC API record is missing a valid {$field}.");
        }

        return $code;
    }

    private function optionalCode(mixed $value): ?string
    {
        if (! is_string($value) && ! is_int($value)) {
            return null;
        }

        $code = trim((string) $value);

        return $code !== '' && preg_match('/^\d{1,12}$/', $code) === 1 ? $code : null;
    }

    private function validate(array &$rows): void
    {
        if ($rows === []) {
            throw new \InvalidArgumentException('The PSGC source contains no location rows.');
        }

        $byCode = [];
        foreach ($rows as $index => $row) {
            $code = $row['code'];
            $parent = $row['parent_code'];
            $level = strtolower($row['level']);
            if (! preg_match('/^\d{1,12}$/', $code)
                || $row['name'] === ''
                || mb_strlen($row['name']) > 150
                || ! isset(self::LEVEL_ORDER[$level])
                || isset($byCode[$code])
                || ($level === 'region' && $parent !== '')
                || ($level !== 'region' && $parent === '')) {
                throw new \InvalidArgumentException(
                    'The PSGC source contains an invalid or duplicate location record at row '.($index + 2).'.'
                );
            }
            $rows[$index]['level'] = $level;
            $byCode[$code] = $rows[$index];
        }

        foreach ($rows as $index => $row) {
            if ($row['parent_code'] === '') {
                continue;
            }
            $parent = $byCode[$row['parent_code']] ?? null;
            if ($parent === null) {
                throw new \InvalidArgumentException(
                    'The PSGC record at row '.($index + 2).' references a missing parent code.'
                );
            }
            $parentLevel = self::LEVEL_ORDER[$parent['level']];
            $childLevel = self::LEVEL_ORDER[$row['level']];
            $allowed = $row['level'] === 'city'
                ? in_array($parent['level'], ['region', 'province'], true)
                : $parentLevel === $childLevel - 1;
            if (! $allowed) {
                throw new \InvalidArgumentException('The PSGC hierarchy is invalid at row '.($index + 2).'.');
            }
        }

        $fullNames = [];
        foreach (array_keys($byCode) as $code) {
            $fullNames[$code] = $this->fullNameFor($code, $byCode, $fullNames);
        }
        foreach ($rows as $index => $row) {
            $rows[$index]['full_name'] = $fullNames[$row['code']];
            if (mb_strlen($rows[$index]['full_name']) > 300) {
                throw new \InvalidArgumentException(
                    'The PSGC hierarchy at row '.($index + 2).' exceeds the supported full-name length.'
                );
            }
        }

        usort($rows, function (array $left, array $right): int {
            $levelOrder = self::LEVEL_ORDER[$left['level']] <=> self::LEVEL_ORDER[$right['level']];

            return $levelOrder !== 0 ? $levelOrder : strcmp($left['code'], $right['code']);
        });
    }

    private function fullNameFor(string $code, array $locations, array &$fullNames): string
    {
        if (isset($fullNames[$code])) {
            return $fullNames[$code];
        }

        $location = $locations[$code];
        $parentCode = $location['parent_code'];
        $fullNames[$code] = $location['name'];

        if ($parentCode !== '') {
            $fullNames[$code] .= ', '.$this->fullNameFor($parentCode, $locations, $fullNames);
        }

        return $fullNames[$code];
    }
}
