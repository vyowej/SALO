<?php

namespace App\Services;

use App\Repositories\Contracts\PsgcLocationRepository;
use Illuminate\Validation\ValidationException;

class PsgcImportService
{
    private const LEVEL_ORDER = [
        'region' => 1,
        'province' => 2,
        'city' => 3,
        'barangay' => 4,
    ];

    public function __construct(private readonly PsgcLocationRepository $locations) {}

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

    private function validate(array &$rows): void
    {
        if ($rows === []) {
            throw new \InvalidArgumentException('The PSGC CSV contains no location rows.');
        }

        $byCode = [];
        foreach ($rows as $index => $row) {
            $code = $row['code'];
            $parent = $row['parent_code'];
            $level = strtolower($row['level']);
            if (! preg_match('/^\d{1,10}$/', $code)
                || $row['name'] === ''
                || ! isset(self::LEVEL_ORDER[$level])
                || isset($byCode[$code])
                || ($level === 'region' && $parent !== '')
                || ($level !== 'region' && $parent === '')) {
                throw ValidationException::withMessages([
                    'file' => ['The PSGC CSV contains an invalid or duplicate location record at row '.($index + 2).'.'],
                ]);
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
                throw ValidationException::withMessages([
                    'file' => ['The PSGC record at row '.($index + 2).' references a missing parent code.'],
                ]);
            }
            $parentLevel = self::LEVEL_ORDER[$parent['level']];
            $childLevel = self::LEVEL_ORDER[$row['level']];
            $allowed = $row['level'] === 'city'
                ? in_array($parent['level'], ['region', 'province'], true)
                : $parentLevel === $childLevel - 1;
            if (! $allowed) {
                throw ValidationException::withMessages([
                    'file' => ['The PSGC hierarchy is invalid at row '.($index + 2).'.'],
                ]);
            }
        }

        $fullNames = [];
        foreach (array_keys($byCode) as $code) {
            $fullNames[$code] = $this->fullNameFor($code, $byCode, $fullNames);
        }
        foreach ($rows as $index => $row) {
            $rows[$index]['full_name'] = $fullNames[$row['code']];
            if (mb_strlen($rows[$index]['full_name']) > 300) {
                throw ValidationException::withMessages([
                    'file' => ['The PSGC hierarchy at row '.($index + 2).' exceeds the supported full-name length.'],
                ]);
            }
        }
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
