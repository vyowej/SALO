<?php

namespace Tests\Integration;

use App\Repositories\Database\DatabaseAddressRepository;
use App\Repositories\Database\DatabasePsgcLocationRepository;
use App\Services\AddressFormatter;
use App\Services\AddressService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\TestCase;

class CustomerAddressAuthoritativeSchemaTest extends TestCase
{
    private static bool $testDatabaseUnavailable = false;

    private bool $transactionStarted = false;

    private string $connectionName = '';

    private string $userId = '';

    private array $locations = [];

    private AddressService $addresses;

    protected function setUp(): void
    {
        parent::setUp();

        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.testing');
        $app->make(Kernel::class)->bootstrap();
        Facade::setFacadeApplication($app);

        $this->connectionName = (string) config('database.default');
        $connectionConfig = config("database.connections.{$this->connectionName}");
        $database = $connectionConfig['database'] ?? null;
        if (! in_array($connectionConfig['driver'] ?? null, ['mysql', 'mariadb'], true)
            || ! is_string($database)
            || preg_match('/_test$/D', $database) !== 1
            || $database === 'salo') {
            self::fail('Address integration tests require a MySQL/MariaDB database whose name ends in _test.');
        }

        if (self::$testDatabaseUnavailable) {
            self::markTestSkipped('The configured _test database server is unavailable.');
        }

        $connection = DB::connection($this->connectionName);
        try {
            $identity = $connection->selectOne('SELECT DATABASE() AS database_name');
        } catch (QueryException $exception) {
            $driverCode = $exception->getPrevious()?->errorInfo[1] ?? null;
            if (in_array((int) $driverCode, [2002, 2003], true)) {
                self::$testDatabaseUnavailable = true;
                self::markTestSkipped('The configured _test database server is unavailable.');
            }

            throw $exception;
        }
        if (($identity->database_name ?? null) !== $database || $identity->database_name === 'salo') {
            self::fail('Connected test database does not match the configured _test database.');
        }

        foreach (['users', 'psgc_locations', 'user_addresses'] as $table) {
            if (! Schema::connection($this->connectionName)->hasTable($table)) {
                self::markTestSkipped('The authoritative schema is not loaded in the configured test database.');
            }
        }

        $connection->beginTransaction();
        $this->transactionStarted = true;
        $this->addresses = new AddressService(
            new DatabaseAddressRepository(new AddressFormatter()),
            new DatabasePsgcLocationRepository(),
        );
        $this->seedAddressFixture();
    }

    protected function tearDown(): void
    {
        if ($this->transactionStarted) {
            DB::connection($this->connectionName)->rollBack();
        }

        restore_error_handler();
        restore_exception_handler();
        parent::tearDown();
    }

    public function test_rejects_a_location_that_is_not_a_barangay(): void
    {
        $this->expectException(ValidationException::class);
        $this->addresses->create($this->userId, [
            'psgc_code' => $this->locations['city'],
            'street' => 'Main Street',
        ]);
    }

    public function test_rejects_mismatched_city_and_province_ancestors(): void
    {
        try {
            $this->addresses->create($this->userId, [
                'province_code' => $this->locations['province_other'],
                'city_code' => $this->locations['city'],
                'barangay_code' => $this->locations['barangay'],
                'street' => 'Main Street',
            ]);
            self::fail('A mismatched province must be rejected.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('province_code', $exception->errors());
        }

        try {
            $this->addresses->create($this->userId, [
                'province_code' => $this->locations['province'],
                'city_code' => $this->locations['city_other'],
                'barangay_code' => $this->locations['barangay'],
                'street' => 'Main Street',
            ]);
            self::fail('A mismatched city must be rejected.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('city_code', $exception->errors());
        }
    }

    public function test_rejects_missing_street(): void
    {
        $this->expectException(ValidationException::class);
        $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
        ]);
    }

    public function test_keeps_one_default_and_soft_deletes_addresses(): void
    {
        $first = $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
            'street' => 'First Street',
        ]);
        $second = $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
            'street' => 'Second Street',
        ]);

        self::assertSame(1, DB::table('user_addresses')
            ->where('user_id', $this->userId)
            ->where('is_default', true)
            ->count());
        self::assertSame('PH', $first['country_code']);
        self::assertSame(
            'Philippines, Test Region, Test Province, Test City, Test Barangay, First Street',
            $first['formatted_address'],
        );

        $this->addresses->setPrimary($this->userId, $second['id']);
        self::assertSame($second['id'], (string) DB::table('user_addresses')
            ->where('user_id', $this->userId)
            ->where('is_default', true)
            ->value('id'));

        self::assertTrue($this->addresses->delete($this->userId, $second['id']));
        self::assertNotNull(DB::table('user_addresses')
            ->where('id', $second['id'])
            ->whereNotNull('deleted_at')
            ->first());
        self::assertSame($first['id'], (string) DB::table('user_addresses')
            ->where('user_id', $this->userId)
            ->where('is_default', true)
            ->value('id'));
        self::assertSame(1, DB::table('user_addresses')
            ->where('user_id', $this->userId)
            ->whereNotNull('default_owner_id')
            ->count());
    }

    public function test_applies_school_and_other_label_mappings(): void
    {
        $home = $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
            'street' => 'Home Street',
            'label' => 'Home',
        ]);
        $work = $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
            'street' => 'Work Street',
            'label' => 'Work',
        ]);
        $church = $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
            'street' => 'Church Street',
            'label' => 'Church',
        ]);
        $school = $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
            'street' => 'School Street',
            'label' => 'School',
        ]);
        $other = $this->addresses->create($this->userId, [
            'province_code' => $this->locations['province'],
            'city_code' => $this->locations['city'],
            'barangay_code' => $this->locations['barangay'],
            'street' => 'Other Street',
            'label' => 'Other',
            'custom_label' => 'Studio',
        ]);

        self::assertSame(['home', 'work', 'church'], [
            $home['address_type'],
            $work['address_type'],
            $church['address_type'],
        ]);
        self::assertSame('other', $school['address_type']);
        self::assertSame('School', $school['label']);
        self::assertNull($school['custom_label']);
        self::assertSame('other', $other['address_type']);
        self::assertSame('Other', $other['label']);
        self::assertSame('Studio', $other['custom_label']);
    }

    public function test_accepts_ncr_and_independent_cities_without_a_province_code(): void
    {
        foreach (['ncr_barangay', 'independent_barangay'] as $key) {
            $address = $this->addresses->create($this->userId, [
                'city_code' => $this->locations[$key === 'ncr_barangay' ? 'ncr_city' : 'independent_city'],
                'barangay_code' => $this->locations[$key],
                'street' => 'Region Direct Street',
            ]);

            self::assertSame('', $address['province']);
            self::assertSame($this->locations[$key], $address['barangay_code']);
        }
    }

    private function seedAddressFixture(): void
    {
        $suffix = (string) random_int(100000000, 999999999);
        $this->userId = (string) DB::table('users')->insertGetId([
            'email' => 'f5-address-'.$suffix.'@example.test',
            'password_hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_BCRYPT),
            'first_name' => 'F5',
            'last_name' => 'Address Test',
        ]);

        $region = '8'.$suffix;
        $province = '7'.$suffix;
        $provinceOther = '6'.$suffix;
        $city = '5'.$suffix;
        $cityOther = '4'.$suffix;
        $barangay = '3'.$suffix;
        $ncrRegion = '2'.$suffix;
        $ncrCity = '1'.$suffix;
        $ncrBarangay = '0'.$suffix;
        $independentCity = '9'.$suffix;
        $independentBarangay = '11'.$suffix;

        $rows = [
            [$region, null, 'Test Region', 'region'],
            [$province, $region, 'Test Province', 'province'],
            [$provinceOther, $region, 'Other Province', 'province'],
            [$city, $province, 'Test City', 'city'],
            [$cityOther, $provinceOther, 'Other City', 'city'],
            [$barangay, $city, 'Test Barangay', 'barangay'],
            [$ncrRegion, null, 'NCR', 'region'],
            [$ncrCity, $ncrRegion, 'NCR City', 'city'],
            [$ncrBarangay, $ncrCity, 'NCR Barangay', 'barangay'],
            [$independentCity, $region, 'Independent City', 'city'],
            [$independentBarangay, $independentCity, 'Independent Barangay', 'barangay'],
        ];

        foreach ($rows as [$code, $parentCode, $name, $level]) {
            DB::table('psgc_locations')->insert([
                'code' => $code,
                'parent_code' => $parentCode,
                'name' => $name,
                'level' => $level,
                'full_name' => $name,
            ]);
        }

        $this->locations = [
            'province' => $province,
            'province_other' => $provinceOther,
            'city' => $city,
            'city_other' => $cityOther,
            'barangay' => $barangay,
            'ncr_city' => $ncrCity,
            'ncr_barangay' => $ncrBarangay,
            'independent_city' => $independentCity,
            'independent_barangay' => $independentBarangay,
        ];
    }
}
