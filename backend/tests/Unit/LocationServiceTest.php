<?php

namespace Tests\Unit;

use App\Exceptions\LocationOutsidePhilippines;
use App\Repositories\Contracts\PsgcLocationRepository;
use App\Services\Location\GeoapifyPlaceSearch;
use App\Services\Location\NominatimReverseGeocoder;
use App\Services\PsgcLocationService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LocationServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        config([
            'location.geoapify_api_key' => 'test-only-key',
            'location.nominatim_user_agent' => 'SALO test suite (test@example.invalid)',
            'location.provider_timeout_seconds' => 2,
            'location.provider_cache_minutes' => 60,
            'location.provider_lock_wait_seconds' => 3,
        ]);
    }

    public function test_street_search_is_ph_limited_and_does_not_expose_provider_keys(): void
    {
        Http::fake([
            'https://api.geoapify.com/*' => Http::response([
                'results' => [
                    [
                        'country_code' => 'ph',
                        'name' => 'Rizal Street',
                        'formatted' => 'Rizal Street, Manila, Philippines',
                        'street' => 'Rizal Street',
                        'housenumber' => '12',
                        'city' => 'Manila',
                        'suburb' => 'Ermita',
                        'lat' => 14.6,
                        'lon' => 121.0,
                    ],
                    [
                        'country_code' => 'us',
                        'formatted' => 'Outside Philippines',
                        'lat' => 40.0,
                        'lon' => -70.0,
                    ],
                ],
            ]),
        ]);

        $result = $this->service()->searchPlaces('Rizal Street', 5);

        self::assertSame([
            'suggestions' => [[
                'label' => 'Rizal Street',
                'detail' => 'Rizal Street, Manila, Philippines',
                'street' => 'Rizal Street',
                'house_no' => '12',
                'city_municipality' => 'Manila',
                'barangay' => 'Ermita',
                'latitude' => 14.6,
                'longitude' => 121.0,
            ]],
        ], $result);
        Http::assertSent(fn (Request $request): bool => str_contains($request->url(), 'filter=countrycode%3Aph')
            && $request->data()['apiKey'] === 'test-only-key'
            && $request->data()['limit'] === 5);
        self::assertStringNotContainsString('test-only-key', json_encode($result, JSON_THROW_ON_ERROR));
    }

    public function test_manila_provider_names_resolve_to_ncr_city_and_specific_barangay(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'building' => 'JG Plaza',
                    'house_number' => '718',
                    'road' => 'P. Paterno Street',
                    'neighbourhood' => 'Barangay 383',
                    'quarter' => 'Barangay 307',
                    'suburb' => 'Quiapo',
                    'city_district' => 'Third District',
                    'city' => 'Manila',
                    'state_district' => 'Capital District',
                    'region' => 'Metro Manila',
                    'ISO3166-2-lvl3' => 'PH-00',
                    'postcode' => '1001',
                    'country' => 'Philippines',
                    'country_code' => 'ph',
                ],
            ]),
        ]);

        $result = $this->service($this->repository($this->manilaRows()))
            ->reverseGeocode(14.5995, 120.9842);

        self::assertSame('130000000', $result['region_code']);
        self::assertNull($result['province_code']);
        self::assertSame('Metro Manila (NCR)', $result['province_display']);
        self::assertSame('133900000', $result['city_code']);
        self::assertSame('133903003', $result['barangay_code']);
        self::assertSame('Barangay 383', $result['barangay']);
        self::assertSame('P. Paterno Street', $result['street']);
        self::assertSame('718', $result['house_no']);
        self::assertSame(
            '718, P. Paterno Street, Barangay 383, City of Manila, Metro Manila (NCR), Philippines',
            $result['formatted_address'],
        );
        self::assertSame([], $result['unresolved_components']);
        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request): bool => $request->hasHeader(
            'User-Agent',
            'SALO test suite (test@example.invalid)',
        ));
    }

    public function test_national_capital_region_alias_and_trailing_city_name_match(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'country_code' => 'ph',
                    'region' => 'National Capital Region',
                    'city' => 'Manila City',
                ],
            ]),
        ]);

        $result = $this->service($this->repository($this->manilaRows()))
            ->reverseGeocode(14.5995, 120.9842);

        self::assertSame('130000000', $result['region_code']);
        self::assertNull($result['province_code']);
        self::assertSame('Metro Manila (NCR)', $result['province_display']);
        self::assertSame('133900000', $result['city_code']);
        self::assertSame([], $result['unresolved_components']);
    }

    public function test_zamboanga_independent_city_and_barangay_still_resolve(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'road' => 'Veterans Avenue',
                    'quarter' => 'Zone III',
                    'suburb' => 'Santa Maria',
                    'city' => 'Zamboanga City',
                    'region' => 'Zamboanga Peninsula',
                    'ISO3166-2-lvl3' => 'PH-09',
                    'postcode' => '7000',
                    'country' => 'Philippines',
                    'country_code' => 'ph',
                ],
            ]),
        ]);

        $result = $this->service($this->repository($this->zamboangaRows()))
            ->reverseGeocode(6.9214, 122.0790);

        self::assertSame('090000000', $result['region_code']);
        self::assertNull($result['province_code']);
        self::assertSame('None (independent city)', $result['province_display']);
        self::assertSame('097332000', $result['city_code']);
        self::assertSame('097332076', $result['barangay_code']);
        self::assertSame([], $result['unresolved_components']);
        Http::assertSentCount(1);
    }

    public function test_duplicate_city_name_only_resolves_under_the_matched_province(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'country_code' => 'ph',
                    'region' => 'A Region',
                    'province' => 'Café Province',
                    'city' => 'SAN  ISIDRO!',
                ],
            ]),
        ]);
        $rows = [
            $this->row('REG-A', null, 'A Region', 'region'),
            $this->row('PROV-A', 'REG-A', 'Cafe Province', 'province'),
            $this->row('PROV-B', 'REG-A', 'Other Province', 'province'),
            $this->row('CITY-A', 'PROV-A', 'San Isidro', 'city'),
            $this->row('CITY-B', 'PROV-B', 'San Isidro', 'city'),
        ];

        $result = $this->service($this->repository($rows))->reverseGeocode(12.0, 123.0);

        self::assertSame('REG-A', $result['region_code']);
        self::assertSame('PROV-A', $result['province_code']);
        self::assertSame('CITY-A', $result['city_code']);
        self::assertNull($result['barangay_code']);
        self::assertSame([], $result['unresolved_components']);
    }

    public function test_unique_cebu_city_match_finds_its_province_when_provider_omits_one(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'neighbourhood' => 'Englis',
                    'quarter' => 'Banawa',
                    'suburb' => 'Guadalupe',
                    'city' => 'Cebu City',
                    'region' => 'Central Visayas',
                    'country_code' => 'ph',
                ],
            ]),
        ]);

        $result = $this->service($this->repository($this->cebuRows()))
            ->reverseGeocode(10.3157, 123.8854);

        self::assertSame('070000000', $result['region_code']);
        self::assertSame('072200000', $result['province_code']);
        self::assertSame('Cebu', $result['province']);
        self::assertSame('072217000', $result['city_code']);
        self::assertSame('072217029', $result['barangay_code']);
        self::assertSame([], $result['unresolved_components']);
    }

    public function test_unique_davao_city_match_finds_its_province_but_keeps_unknown_barangay_unresolved(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'quarter' => 'Barangay 32-D',
                    'suburb' => 'Poblacion District',
                    'city' => 'Davao City',
                    'region' => 'Davao Region',
                    'country_code' => 'ph',
                ],
            ]),
        ]);

        $result = $this->service($this->repository($this->davaoRows()))
            ->reverseGeocode(7.0731, 125.6128);

        self::assertSame('110000000', $result['region_code']);
        self::assertSame('112400000', $result['province_code']);
        self::assertSame('Davao Del Sur', $result['province']);
        self::assertSame('112402000', $result['city_code']);
        self::assertNull($result['barangay_code']);
        self::assertSame(['barangay'], $result['unresolved_components']);
    }

    public function test_city_fallback_stays_unresolved_when_the_name_matches_multiple_provinces(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'country_code' => 'ph',
                    'region' => 'A Region',
                    'city' => 'San Isidro',
                ],
            ]),
        ]);
        $rows = [
            $this->row('REG-A', null, 'A Region', 'region'),
            $this->row('PROV-A', 'REG-A', 'Province A', 'province'),
            $this->row('PROV-B', 'REG-A', 'Province B', 'province'),
            $this->row('CITY-A', 'PROV-A', 'San Isidro', 'city'),
            $this->row('CITY-B', 'PROV-B', 'San Isidro', 'city'),
        ];

        $result = $this->service($this->repository($rows))->reverseGeocode(12.0, 123.0);

        self::assertSame('REG-A', $result['region_code']);
        self::assertNull($result['province_code']);
        self::assertNull($result['city_code']);
        self::assertSame(['city'], $result['unresolved_components']);
    }

    public function test_unmatched_barangay_does_not_prevent_higher_level_resolution(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'country_code' => 'ph',
                    'region' => 'Metro Manila',
                    'city' => 'Manila',
                    'neighbourhood' => 'Unknown Barangay',
                ],
            ]),
        ]);

        $result = $this->service($this->repository($this->manilaRows()))
            ->reverseGeocode(14.6, 120.98);

        self::assertSame('130000000', $result['region_code']);
        self::assertSame('133900000', $result['city_code']);
        self::assertNull($result['barangay_code']);
        self::assertSame(['barangay'], $result['unresolved_components']);
    }

    public function test_unknown_region_prevents_city_and_barangay_resolution(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'country_code' => 'ph',
                    'region' => 'Unknown Region',
                    'city' => 'Manila',
                    'neighbourhood' => 'Barangay 383',
                ],
            ]),
        ]);

        $result = $this->service($this->repository($this->manilaRows()))
            ->reverseGeocode(14.61, 120.98);

        self::assertNull($result['region_code']);
        self::assertNull($result['province_code']);
        self::assertNull($result['city_code']);
        self::assertNull($result['barangay_code']);
        self::assertSame(['region', 'city', 'barangay'], $result['unresolved_components']);
    }

    public function test_reverse_geocoding_caches_the_raw_provider_lookup(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => [
                    'country_code' => 'ph',
                    'region' => 'Zamboanga Peninsula',
                    'city' => 'Zamboanga City',
                ],
            ]),
        ]);
        $service = $this->service($this->repository($this->zamboangaRows()));

        $first = $service->reverseGeocode(7.0, 122.0);
        $second = $service->reverseGeocode(7.0, 122.0);

        self::assertSame($first, $second);
        self::assertSame('097332000', $second['city_code']);
        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request): bool => $request->hasHeader(
            'User-Agent',
            'SALO test suite (test@example.invalid)',
        ));
        $cachedPayload = Cache::get('location:nominatim:'.hash('sha256', sprintf('%.5F,%.5F', 7.0, 122.0)));
        self::assertSame('Zamboanga Peninsula', $cachedPayload['address']['region']);
        self::assertArrayNotHasKey('region_code', $cachedPayload);
    }

    public function test_reverse_geocoding_rejects_out_of_bounds_coordinates_before_provider_call(): void
    {
        Http::fake();

        try {
            $this->service()->reverseGeocode(25.0, 121.0);
            self::fail('Out-of-bounds coordinates should be rejected.');
        } catch (LocationOutsidePhilippines) {
            Http::assertNothingSent();
        }
    }

    public function test_reverse_geocoding_rejects_non_philippine_provider_results(): void
    {
        Http::fake([
            'https://nominatim.openstreetmap.org/reverse*' => Http::response([
                'address' => ['country_code' => 'tw'],
            ]),
        ]);

        $this->expectException(LocationOutsidePhilippines::class);
        $this->service()->reverseGeocode(14.6, 121.0);
    }

    private function service(?PsgcLocationRepository $repository = null): PsgcLocationService
    {
        return new PsgcLocationService(
            $repository ?? $this->repository(),
            new GeoapifyPlaceSearch,
            new NominatimReverseGeocoder,
        );
    }

    private function repository(array $rows = []): LocationServicePsgcRepositoryStub
    {
        return new LocationServicePsgcRepositoryStub($rows);
    }

    private function manilaRows(): array
    {
        return [
            $this->row('130000000', null, 'NCR', 'region'),
            $this->row('133900000', '130000000', 'City of Manila', 'city'),
            $this->row('133903003', '133900000', 'Barangay 383', 'barangay'),
            $this->row('133903016', '133900000', 'Barangay 307', 'barangay'),
        ];
    }

    private function zamboangaRows(): array
    {
        return [
            $this->row('090000000', null, 'Zamboanga Peninsula', 'region'),
            $this->row('097332000', '090000000', 'Zamboanga City', 'city'),
            $this->row('097332076', '097332000', 'Santa Maria', 'barangay'),
        ];
    }

    private function cebuRows(): array
    {
        return [
            $this->row('070000000', null, 'Central Visayas', 'region'),
            $this->row('072200000', '070000000', 'Cebu', 'province'),
            $this->row('072217000', '072200000', 'City of Cebu', 'city'),
            $this->row('072217029', '072217000', 'Guadalupe', 'barangay'),
        ];
    }

    private function davaoRows(): array
    {
        return [
            $this->row('110000000', null, 'Davao Region', 'region'),
            $this->row('112400000', '110000000', 'Davao Del Sur', 'province'),
            $this->row('112402000', '112400000', 'City of Davao', 'city'),
            $this->row('112402165', '112402000', 'Barangay 32-D (Pob.)', 'barangay'),
        ];
    }

    private function row(string $code, ?string $parentCode, string $name, string $level): array
    {
        return [
            'code' => $code,
            'parent_code' => $parentCode,
            'name' => $name,
            'level' => $level,
        ];
    }
}

class LocationServicePsgcRepositoryStub implements PsgcLocationRepository
{
    public function __construct(private readonly array $rows = []) {}

    public function listByLevelParent(string $level, ?string $parentCode, ?string $search): array
    {
        return array_values(array_filter($this->rows, static function (array $row) use ($level, $parentCode, $search): bool {
            if ($row['level'] !== $level || $row['parent_code'] !== $parentCode) {
                return false;
            }

            return $search === null || $search === '' || stripos($row['name'], $search) !== false;
        }));
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

    public function upsert(array $locations): void {}

    public function verificationReport(): array
    {
        return [];
    }
}
