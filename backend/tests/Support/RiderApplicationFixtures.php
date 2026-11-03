<?php

namespace Tests\Support;

use App\Models\PlatformAdmin;
use App\Models\PsgcLocation;
use App\Models\RiderProfile;
use App\Models\RiderDocument;
use App\Models\Shift;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

final class RiderApplicationFixtures
{
    private static int $locationSequence = 0;

    public static function user(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password_hash' => Hash::make('Password123'),
            'first_name' => 'Rider',
            'last_name' => 'Applicant',
            'status' => 'active',
        ]);
    }

    public static function admin(string $email): User
    {
        $user = self::user($email);
        PlatformAdmin::query()->create([
            'user_id' => $user->getKey(),
            'admin_level' => 'super',
            'status' => 'active',
        ]);

        return $user;
    }

    public static function barangay(): PsgcLocation
    {
        $sequence = str_pad((string) ++self::$locationSequence, 9, '0', STR_PAD_LEFT);
        $region = PsgcLocation::query()->create([
            'code' => 'R'.$sequence,
            'name' => 'Test Region',
            'level' => 'region',
            'full_name' => 'Test Region',
        ]);
        $province = PsgcLocation::query()->create([
            'code' => 'P'.$sequence,
            'parent_code' => $region->getKey(),
            'name' => 'Test Province',
            'level' => 'province',
            'full_name' => 'Test Province, Test Region',
        ]);
        $city = PsgcLocation::query()->create([
            'code' => 'C'.$sequence,
            'parent_code' => $province->getKey(),
            'name' => 'Test City',
            'level' => 'city',
            'full_name' => 'Test City, Test Province, Test Region',
        ]);

        return PsgcLocation::query()->create([
            'code' => 'B'.$sequence,
            'parent_code' => $city->getKey(),
            'name' => 'Test Barangay',
            'level' => 'barangay',
            'full_name' => 'Test Barangay, Test City, Test Province, Test Region',
        ]);
    }

    public static function pendingActivation(User $user): RiderProfile
    {
        $barangay = self::barangay();

        return RiderProfile::query()->create([
            'user_id' => $user->getKey(),
            'application_status' => 'approved',
            'status' => 'pending_activation',
            'vehicle_type' => 'bicycle',
            'psgc_code' => $barangay->getKey(),
            'street' => '1 Test Street',
            'formatted_address' => '1 Test Street, Test Barangay, Test City, Test Province, Test Region, Philippines',
            'ewallet_account_name' => 'Rider Applicant',
            'approved_at' => now(),
        ]);
    }

    public static function submittedApplication(User $user): RiderProfile
    {
        $barangay = self::barangay();
        $user->forceFill([
            'birthday' => now()->subYears(25)->toDateString(),
            'mobile' => '09171234567',
        ])->save();
        $profile = RiderProfile::query()->create([
            'user_id' => $user->getKey(),
            'application_status' => 'submitted',
            'vehicle_type' => 'bicycle',
            'psgc_code' => $barangay->getKey(),
            'street' => '12 Test Street',
            'house_no' => '12',
            'formatted_address' => 'Philippines, Test Region, Test Province, Test City, Test Barangay, 12 Test Street, 12',
            'ewallet_account_name' => 'Rider Applicant',
            'declared_clearance_tin' => true,
            'submitted_at' => now(),
        ]);
        $profile->preferredShifts()->sync([Shift::query()->value('id')]);

        foreach (['profile_photo', 'id_photo'] as $docType) {
            RiderDocument::query()->create([
                'rider_id' => $profile->getKey(),
                'doc_type' => $docType,
                'private_path' => 'riders/'.$profile->getKey().'/documents/'.$docType.'-'.str_repeat('d', 40).'.jpg',
            ]);
        }

        return $profile;
    }

    public static function rejectedApplication(User $user): RiderProfile
    {
        $barangay = self::barangay();

        return RiderProfile::query()->create([
            'user_id' => $user->getKey(),
            'application_status' => 'rejected',
            'vehicle_type' => 'bicycle',
            'psgc_code' => $barangay->getKey(),
            'street' => '12 Test Street',
            'formatted_address' => 'Philippines, Test Region, Test Province, Test City, Test Barangay, 12 Test Street',
        ]);
    }
}
