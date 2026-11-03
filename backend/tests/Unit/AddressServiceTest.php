<?php

namespace Tests\Unit;

use App\Repositories\Contracts\AddressRepository;
use App\Repositories\Contracts\PsgcLocationRepository;
use App\Services\AddressService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AddressServiceTest extends TestCase
{
    public function test_rejects_non_barangay_location_codes(): void
    {
        $service = $this->service();

        $this->expectException(ValidationException::class);
        $service->create('1', ['psgc_code' => 'CITY1', 'street' => 'Main Road']);
    }

    public function test_rejects_city_and_province_codes_that_do_not_match_barangay_ancestry(): void
    {
        $service = $this->service();

        try {
            $service->create('1', [
                'province_code' => 'PROV2',
                'city_code' => 'CITY1',
                'barangay_code' => 'BRGY1',
                'street' => 'Main Road',
            ]);
            self::fail('Mismatched province was accepted.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('province_code', $exception->errors());
        }

        try {
            $service->create('1', [
                'province_code' => 'PROV1',
                'city_code' => 'CITY2',
                'barangay_code' => 'BRGY1',
                'street' => 'Main Road',
            ]);
            self::fail('Mismatched city was accepted.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('city_code', $exception->errors());
        }
    }

    public function test_rejects_missing_street_and_canonicalizes_address_payload(): void
    {
        $repository = new RecordingAddressRepository();
        $service = $this->service($repository);

        try {
            $service->create('1', [
                'province_code' => 'PROV1',
                'city_code' => 'CITY1',
                'barangay_code' => 'BRGY1',
            ]);
            self::fail('Missing street was accepted.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('street', $exception->errors());
        }

        $service->create('1', [
            'country_code' => 'PH',
            'province_code' => 'PROV1',
            'city_code' => 'CITY1',
            'barangay_code' => 'BRGY1',
            'street' => '  Main Road  ',
            'label' => 'School',
            'formatted_address' => 'client supplied text',
        ]);

        self::assertSame('BRGY1', $repository->created['psgc_code']);
        self::assertSame('PH', $repository->created['country_code']);
        self::assertSame('Main Road', $repository->created['street']);
        self::assertSame('School', $repository->created['label']);
        self::assertSame('other', $repository->created['address_type']);
        self::assertNull($repository->created['custom_label']);
        self::assertArrayNotHasKey('formatted_address', $repository->created);
        self::assertArrayNotHasKey('city_code', $repository->created);
        self::assertArrayNotHasKey('province_code', $repository->created);
    }

    public function test_maps_supported_address_labels_to_schema_values(): void
    {
        $repository = new RecordingAddressRepository();
        $service = $this->service($repository);
        $base = [
            'province_code' => 'PROV1',
            'city_code' => 'CITY1',
            'barangay_code' => 'BRGY1',
            'street' => 'Main Road',
        ];

        foreach ([
            ['Home', 'home', null],
            ['Work', 'work', null],
            ['Church', 'church', null],
            ['School', 'other', null],
            ['Other', 'other', 'Studio'],
        ] as [$label, $type, $customLabel]) {
            $service->create('1', array_merge($base, [
                'label' => $label,
                'custom_label' => $customLabel,
            ]));

            self::assertSame($label, $repository->created['label']);
            self::assertSame($type, $repository->created['address_type']);
            self::assertSame($customLabel, $repository->created['custom_label']);
        }
    }

    public function test_accepts_region_direct_cities_without_a_province(): void
    {
        $repository = new RecordingAddressRepository();
        $service = $this->service($repository);

        $service->create('1', [
            'city_code' => 'NCRCITY',
            'barangay_code' => 'NCRBRGY',
            'street' => 'Main Road',
        ]);

        self::assertSame('NCRBRGY', $repository->created['psgc_code']);
        self::assertSame('PH', $repository->created['country_code']);
    }

    private function service(?RecordingAddressRepository $addresses = null): AddressService
    {
        return new AddressService(
            $addresses ?? new RecordingAddressRepository(),
            new RecordingAddressPsgcRepository(),
        );
    }
}

class RecordingAddressRepository implements AddressRepository
{
    public array $created = [];

    public function allForUser(string $userId): array
    {
        return [];
    }

    public function findForUser(string $userId, string $addressId): ?array
    {
        return null;
    }

    public function create(string $userId, array $attributes): array
    {
        $this->created = $attributes;

        return $attributes;
    }

    public function update(string $userId, string $addressId, array $attributes): ?array
    {
        return null;
    }

    public function delete(string $userId, string $addressId): bool
    {
        return false;
    }

    public function setPrimary(string $userId, string $addressId): ?array
    {
        return null;
    }
}

class RecordingAddressPsgcRepository implements PsgcLocationRepository
{
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
        return match ($code) {
            'BRGY1' => [
                ['code' => 'BRGY1', 'level' => 'barangay'],
                ['code' => 'CITY1', 'level' => 'city'],
                ['code' => 'PROV1', 'level' => 'province'],
                ['code' => 'REGION1', 'level' => 'region'],
            ],
            'CITY1' => [
                ['code' => 'CITY1', 'level' => 'city'],
                ['code' => 'PROV1', 'level' => 'province'],
                ['code' => 'REGION1', 'level' => 'region'],
            ],
            'NCRBRGY' => [
                ['code' => 'NCRBRGY', 'level' => 'barangay'],
                ['code' => 'NCRCITY', 'level' => 'city'],
                ['code' => 'NCR', 'level' => 'region'],
            ],
            default => null,
        };
    }

    public function upsert(array $locations): void {}

    public function verificationReport(): array
    {
        return [];
    }
}
