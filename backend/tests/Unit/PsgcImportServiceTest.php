<?php

namespace Tests\Unit;

use App\Repositories\Contracts\PsgcLocationRepository;
use App\Services\PsgcImportService;
use PHPUnit\Framework\TestCase;

class PsgcImportServiceTest extends TestCase
{
    public function test_cached_api_data_is_normalized_and_ordered_for_import(): void
    {
        $directory = $this->writeCache($this->apiDatasets());
        $repository = new RecordingPsgcLocationRepository();

        try {
            $count = (new PsgcImportService($repository))->importSource($directory);

            self::assertSame(11, $count);
            self::assertCount(11, $repository->locations);
            self::assertSame(
                [
                    'region', 'region', 'region',
                    'province', 'province', 'province',
                    'city', 'city', 'city',
                    'barangay', 'barangay',
                ],
                array_column($repository->locations, 'level'),
            );
            self::assertSame('097300000', $this->location($repository, '097301000')['parent_code']);
            self::assertSame('090000000', $this->location($repository, '097332000')['parent_code']);
            self::assertSame('Zamboanga City', $this->location($repository, '097332000')['name']);
            self::assertSame('130000000', $this->location($repository, '133900000')['parent_code']);
            self::assertSame('133900000', $this->location($repository, '133901001')['parent_code']);
            self::assertSame(
                'Barangay 1, City of Manila, NCR',
                $this->location($repository, '133901001')['full_name'],
            );
            self::assertSame(
                'Boalan, Zamboanga City, Zamboanga Peninsula',
                $this->location($repository, '097332001')['full_name'],
            );
            self::assertSame(
                ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay', 'Zamboanga City'],
                array_values(array_intersect(
                    ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay', 'Zamboanga City'],
                    array_column($repository->locations, 'name'),
                )),
            );
        } finally {
            $this->removeCache($directory);
        }
    }

    public function test_invalid_city_parent_is_rejected_before_repository_write(): void
    {
        $datasets = $this->apiDatasets();
        $datasets['cities-municipalities'][0]['provinceCode'] = '099999999';
        $directory = $this->writeCache($datasets);
        $repository = new RecordingPsgcLocationRepository();

        try {
            $this->expectException(\InvalidArgumentException::class);
            (new PsgcImportService($repository))->importSource($directory);
        } finally {
            $this->removeCache($directory);
            self::assertSame([], $repository->locations);
        }
    }

    private function apiDatasets(): array
    {
        return [
            'regions' => [
                ['code' => '010000000', 'name' => 'Ilocos Region'],
                ['code' => '090000000', 'name' => 'Zamboanga Peninsula'],
                ['code' => '130000000', 'name' => 'NCR'],
            ],
            'provinces' => [
                ['code' => '097200000', 'name' => 'Zamboanga del Norte', 'regionCode' => '090000000'],
                ['code' => '097300000', 'name' => 'Zamboanga del Sur', 'regionCode' => '090000000'],
                ['code' => '098300000', 'name' => 'Zamboanga Sibugay', 'regionCode' => '090000000'],
            ],
            'cities-municipalities' => [
                [
                    'code' => '097301000',
                    'name' => 'Aurora',
                    'provinceCode' => '097300000',
                    'regionCode' => '090000000',
                ],
                [
                    'code' => '097332000',
                    'name' => 'City of Zamboanga',
                    'provinceCode' => '097300000',
                    'regionCode' => '090000000',
                ],
                [
                    'code' => '133900000',
                    'name' => 'City of Manila',
                    'provinceCode' => false,
                    'regionCode' => '130000000',
                ],
            ],
            'barangays' => [
                [
                    'code' => '097332001',
                    'name' => 'Boalan',
                    'cityCode' => '097332000',
                    'municipalityCode' => false,
                ],
                [
                    'code' => '133901001',
                    'name' => 'Barangay 1',
                    'cityCode' => '133900000',
                    'municipalityCode' => false,
                    'subMunicipalityCode' => '133901000',
                    'districtCode' => '133900000',
                ],
            ],
        ];
    }

    private function writeCache(array $datasets): string
    {
        $directory = sys_get_temp_dir().DIRECTORY_SEPARATOR.'salo-psgc-'.bin2hex(random_bytes(6));
        mkdir($directory);

        foreach ([
            'regions' => 'regions.json',
            'provinces' => 'provinces.json',
            'cities-municipalities' => 'cities-municipalities.json',
            'barangays' => 'barangays.json',
        ] as $key => $filename) {
            file_put_contents(
                $directory.DIRECTORY_SEPARATOR.$filename,
                json_encode($datasets[$key], JSON_THROW_ON_ERROR),
            );
        }

        return $directory;
    }

    private function removeCache(string $directory): void
    {
        foreach (glob($directory.DIRECTORY_SEPARATOR.'*') ?: [] as $path) {
            unlink($path);
        }
        rmdir($directory);
    }

    private function location(RecordingPsgcLocationRepository $repository, string $code): array
    {
        foreach ($repository->locations as $location) {
            if ($location['code'] === $code) {
                return $location;
            }
        }

        self::fail("Missing imported PSGC code {$code}.");
    }
}

class RecordingPsgcLocationRepository implements PsgcLocationRepository
{
    public array $locations = [];

    public function listByLevelParent(string $level, ?string $parentCode, ?string $search): array
    {
        return [];
    }

    public function search(string $query, ?string $level = null, ?string $parentCode = null): array
    {
        return [];
    }

    public function resolveAdministrativeCandidates(array $namesByLevel): array
    {
        return [];
    }

    public function hierarchyForCode(string $code): ?array
    {
        return null;
    }

    public function upsert(array $locations): void
    {
        $this->locations = $locations;
    }

    public function verificationReport(): array
    {
        return [];
    }
}
