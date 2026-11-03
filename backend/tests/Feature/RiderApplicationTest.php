<?php

namespace Tests\Feature;

use App\Models\AuthToken;
use App\Models\PlatformSetting;
use App\Models\RiderDocument;
use App\Models\RiderProfile;
use App\Models\Shift;
use App\Models\User;
use App\Notifications\RiderActivationNotification;
use App\Services\AuthTokenService;
use App\Services\PrivateRiderDocumentStorageService;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Tests\Support\RiderApplicationFixtures;
use Tests\TestCase;

class RiderApplicationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Notification::fake();
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ]);
    }

    public function test_customer_starts_one_database_backed_draft_and_cannot_create_a_second_profile(): void
    {
        $user = RiderApplicationFixtures::user('one-rider@example.test');

        $first = $this->asCustomer($user)
            ->postJson('/api/v1/applications/riders')
            ->assertCreated();
        $first
            ->assertJsonPath('data.application_status', 'draft');
        $second = $this->postJson('/api/v1/applications/riders')
            ->assertOk();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(1, RiderProfile::query()->where('user_id', $user->getKey())->count());

        try {
            RiderProfile::query()->create(['user_id' => $user->getKey()]);
            $this->fail('The authoritative unique user key must prevent a second rider profile.');
        } catch (QueryException) {
            $this->assertSame(1, RiderProfile::query()->where('user_id', $user->getKey())->count());
        }
    }

    public function test_authoritative_address_check_rejects_non_draft_without_a_complete_address(): void
    {
        $user = RiderApplicationFixtures::user('address-check@example.test');

        try {
            RiderProfile::query()->create([
                'user_id' => $user->getKey(),
                'application_status' => 'submitted',
            ]);
            $this->fail('The authoritative address check must reject a submitted profile without a barangay address.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('chk_rider_address_when_submitted', $exception->getMessage());
        }

        $application = $this->asCustomer($user)->postJson('/api/v1/applications/riders')->assertCreated();
        $region = RiderApplicationFixtures::barangay()->parent->parent;
        $invalidAddress = $this->patchJson('/api/v1/applications/riders/'.$application->json('data.id'), [
            'psgc_code' => $region->getKey(),
            'street' => 'Test Street',
        ])->assertUnprocessable();
        $this->assertSame(
            'Choose a barangay-level location.',
            $invalidAddress->json('error.fields.psgc_code.0'),
        );
    }

    public function test_rider_cannot_read_another_applications_profile_or_private_documents(): void
    {
        $owner = RiderApplicationFixtures::user('private-owner@example.test');
        $other = RiderApplicationFixtures::user('private-other@example.test');
        $profile = RiderApplicationFixtures::pendingActivation($owner);
        $path = 'riders/'.$profile->getKey().'/documents/id_photo-'.str_repeat('a', 40).'.jpg';
        Storage::disk('private')->put($path, 'private image bytes');
        $document = RiderDocument::query()->create([
            'rider_id' => $profile->getKey(),
            'doc_type' => 'id_photo',
            'private_path' => $path,
        ]);

        $this->asCustomer($other)
            ->getJson('/api/v1/applications/riders/'.$profile->getKey())
            ->assertNotFound();
        $this->getJson('/api/v1/applications/riders/'.$profile->getKey().'/documents/'.$document->getKey().'/download-url')
            ->assertForbidden();

        $signedUrl = URL::temporarySignedRoute(
            'api.v1.private-rider-documents.download',
            now()->addMinutes(5),
            ['document' => $document->getKey()],
        );
        $this->getJson($signedUrl)->assertForbidden();

    }

    public function test_private_rider_document_path_traversal_is_rejected(): void
    {
        $owner = RiderApplicationFixtures::user('path-owner@example.test');
        $profile = RiderApplicationFixtures::pendingActivation($owner);
        $document = RiderDocument::query()->create([
            'rider_id' => $profile->getKey(),
            'doc_type' => 'id_photo',
            'private_path' => 'riders/'.$profile->getKey().'/documents/id_photo-'.str_repeat('c', 40).'.jpg',
        ]);
        $document->forceFill(['private_path' => 'riders/'.$profile->getKey().'/documents/../../outside.jpg'])->save();

        $this->asCustomer($owner)
            ->getJson('/api/v1/applications/riders/'.$profile->getKey().'/documents/'.$document->getKey().'/download-url')
            ->assertNotFound();
    }

    public function test_signed_private_rider_document_url_expires(): void
    {
        $owner = RiderApplicationFixtures::user('expiry-owner@example.test');
        $profile = RiderApplicationFixtures::pendingActivation($owner);
        $path = 'riders/'.$profile->getKey().'/documents/id_photo-'.str_repeat('b', 40).'.jpg';
        Storage::disk('private')->put($path, 'private image bytes');
        $document = RiderDocument::query()->create([
            'rider_id' => $profile->getKey(),
            'doc_type' => 'id_photo',
            'private_path' => $path,
        ]);
        $downloadUrl = $this->asCustomer($owner)
            ->getJson('/api/v1/applications/riders/'.$profile->getKey().'/documents/'.$document->getKey().'/download-url')
            ->assertOk()
            ->json('data.url');

        $this->travel(6)->minutes();
        $this->getJson($downloadUrl)->assertForbidden();
    }

    public function test_private_image_upload_reencodes_and_replaces_the_old_file(): void
    {
        $user = RiderApplicationFixtures::user('image-upload@example.test');
        $profile = RiderProfile::query()->create(['user_id' => $user->getKey()]);
        $this->asCustomer($user)
            ->post('/api/v1/applications/riders/'.$profile->getKey().'/documents', [
                'doc_type' => 'profile_photo',
                'file' => UploadedFile::fake()->image('first.png', 640, 480),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonMissingPath('data.documents.0.private_path');

        $oldPath = RiderDocument::query()->where('rider_id', $profile->getKey())->value('private_path');
        $this->assertMatchesRegularExpression('/\Ariders\/'.$profile->getKey().'\/documents\/profile_photo-[A-Za-z0-9]{40}\.jpg\z/', $oldPath);
        $this->assertTrue(Storage::disk('private')->exists($oldPath));

        $this->post('/api/v1/applications/riders/'.$profile->getKey().'/documents', [
            'doc_type' => 'profile_photo',
            'file' => UploadedFile::fake()->image('replacement.webp', 800, 600),
        ], ['Accept' => 'application/json'])->assertOk();
        $newPath = RiderDocument::query()->where('rider_id', $profile->getKey())->value('private_path');

        $this->assertNotSame($oldPath, $newPath);
        $this->assertFalse(Storage::disk('private')->exists($oldPath));
        $this->assertTrue(Storage::disk('private')->exists($newPath));
    }

    public function test_private_image_upload_strips_exif_metadata(): void
    {
        $user = RiderApplicationFixtures::user('exif-upload@example.test');
        $profile = RiderProfile::query()->create(['user_id' => $user->getKey()]);
        $source = UploadedFile::fake()->image('source.jpg', 64, 64);
        $jpeg = file_get_contents($source->getRealPath());
        $this->assertIsString($jpeg);

        $exif = "Exif\0\0II*\0\x08\0\0\0\0\0\0\0\0";
        $segment = "\xFF\xE1".pack('n', strlen($exif) + 2).$exif;
        $jpegWithExif = substr($jpeg, 0, 2).$segment.substr($jpeg, 2);
        $this->assertStringContainsString("Exif\0\0", $jpegWithExif);

        $temporaryPath = tempnam(sys_get_temp_dir(), 'rider-exif-');
        $this->assertIsString($temporaryPath);
        try {
            $this->assertNotFalse(file_put_contents($temporaryPath, $jpegWithExif));
            $upload = new UploadedFile($temporaryPath, 'exif.jpg', 'image/jpeg', null, true);
            $this->asCustomer($user)
                ->post('/api/v1/applications/riders/'.$profile->getKey().'/documents', [
                    'doc_type' => 'profile_photo',
                    'file' => $upload,
                ], ['Accept' => 'application/json'])
                ->assertOk();
        } finally {
            @unlink($temporaryPath);
        }

        $path = RiderDocument::query()->where('rider_id', $profile->getKey())->value('private_path');
        $this->assertIsString($path);
        $this->assertStringNotContainsString("Exif\0\0", Storage::disk('private')->get($path));
    }

    public function test_server_rejects_fake_mime_and_oversized_rider_files(): void
    {
        $user = RiderApplicationFixtures::user('invalid-upload@example.test');
        $profile = RiderProfile::query()->create(['user_id' => $user->getKey()]);

        $this->asCustomer($user)
            ->post('/api/v1/applications/riders/'.$profile->getKey().'/documents', [
                'doc_type' => 'id_photo',
                'file' => UploadedFile::fake()->createWithContent('fake.jpg', 'not an image'),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $validImage = UploadedFile::fake()->image('valid.jpg', 100, 100);
        $wrongExtension = new UploadedFile(
            $validImage->getRealPath(),
            'wrong-extension.txt',
            'image/jpeg',
            null,
            true,
        );
        $wrongExtensionResponse = $this->post('/api/v1/applications/riders/'.$profile->getKey().'/documents', [
            'doc_type' => 'id_photo',
            'file' => $wrongExtension,
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $this->assertArrayHasKey('file', $wrongExtensionResponse->json('error.fields'));

        $this->post('/api/v1/applications/riders/'.$profile->getKey().'/documents', [
            'doc_type' => 'id_photo',
            'file' => UploadedFile::fake()->createWithContent('oversize.jpg', str_repeat('x', 2 * 1024 * 1024 + 1)),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $this->assertSame(0, RiderDocument::query()->where('rider_id', $profile->getKey())->count());
    }

    public function test_activation_otp_is_hashed_expiring_single_use_and_limited_to_five_attempts(): void
    {
        $this->setOtpSettings();
        $expiredUser = RiderApplicationFixtures::user('otp-expired@example.test');
        $expiredProfile = RiderApplicationFixtures::pendingActivation($expiredUser);
        $expiredCode = app(AuthTokenService::class)->issueOtp($expiredUser, 'rider_activation', $expiredUser->email);
        $expiredToken = AuthToken::query()->where('user_id', $expiredUser->getKey())->firstOrFail();
        $this->assertNotSame($expiredCode, $expiredToken->token_hash);
        $this->assertTrue(Hash::check($expiredCode, $expiredToken->token_hash));
        $this->assertEqualsWithDelta(
            now()->addMinutes(10)->getTimestamp(),
            $expiredToken->expires_at->getTimestamp(),
            1,
        );

        $this->travel(11)->minutes();
        $this->assertValidationFails(fn () => app(AuthTokenService::class)->verifyRiderActivation($expiredUser, (int) $expiredProfile->getKey(), $expiredCode));
        $this->assertSame('pending_activation', $expiredProfile->fresh()->status);
        $this->travelBack();

        $attemptUser = RiderApplicationFixtures::user('otp-attempts@example.test');
        $attemptProfile = RiderApplicationFixtures::pendingActivation($attemptUser);
        $attemptCode = app(AuthTokenService::class)->issueOtp($attemptUser, 'rider_activation', $attemptUser->email);
        $this->assertValidationFails(fn () => app(AuthTokenService::class)->issueOtp($attemptUser, 'rider_activation', $attemptUser->email));
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->assertValidationFails(fn () => app(AuthTokenService::class)->verifyRiderActivation($attemptUser, (int) $attemptProfile->getKey(), '999999'));
        }
        $attemptToken = AuthToken::query()->where('user_id', $attemptUser->getKey())->firstOrFail();
        $this->assertSame(5, $attemptToken->attempts);
        $this->assertValidationFails(fn () => app(AuthTokenService::class)->verifyRiderActivation($attemptUser, (int) $attemptProfile->getKey(), $attemptCode));
        $this->assertSame('pending_activation', $attemptProfile->fresh()->status);

        $activeUser = RiderApplicationFixtures::user('otp-active@example.test');
        $activeProfile = RiderApplicationFixtures::pendingActivation($activeUser);
        $activeCode = app(AuthTokenService::class)->issueOtp($activeUser, 'rider_activation', $activeUser->email);
        app(AuthTokenService::class)->verifyRiderActivation($activeUser, (int) $activeProfile->getKey(), $activeCode);
        $this->assertSame('active', $activeProfile->fresh()->status);
        $this->assertNotNull(AuthToken::query()->where('user_id', $activeUser->getKey())->value('used_at'));
        $this->assertValidationFails(fn () => app(AuthTokenService::class)->verifyRiderActivation($activeUser, (int) $activeProfile->getKey(), $activeCode));
    }

    public function test_complete_rider_application_submission_persists_the_address_and_documents(): void
    {
        $user = RiderApplicationFixtures::user('full-flow@example.test');
        $barangay = RiderApplicationFixtures::barangay();
        $shift = Shift::query()->firstOrFail();

        $application = $this->asCustomer($user)
            ->postJson('/api/v1/applications/riders')
            ->assertCreated();
        $riderId = $application->json('data.id');
        $this->patchJson('/api/v1/applications/riders/'.$riderId, [
            'vehicle_type' => 'bicycle',
            'first_name' => 'Rider',
            'last_name' => 'Applicant',
            'birthday' => now()->subYears(25)->toDateString(),
            'mobile' => '09171234567',
            'preferred_shift_ids' => [(int) $shift->getKey()],
            'psgc_code' => $barangay->getKey(),
            'street' => '12 Test Street',
            'house_no' => '12',
            'ewallet_account_name' => 'Rider Applicant',
            'declared_clearance_tin' => true,
        ])->assertOk();

        foreach (['profile_photo', 'id_photo'] as $docType) {
            $this->post('/api/v1/applications/riders/'.$riderId.'/documents', [
                'doc_type' => $docType,
                'file' => UploadedFile::fake()->image($docType.'.jpg', 640, 480),
            ], ['Accept' => 'application/json'])->assertOk();
        }

        $this->postJson('/api/v1/applications/riders/'.$riderId.'/submit', ['terms_accepted' => true])
            ->assertOk()
            ->assertJsonPath('data.application_status', 'submitted')
            ->assertJsonPath('data.address.formatted_address', 'Philippines, Test Region, Test Province, Test City, Test Barangay, 12 Test Street, 12');

        $this->assertDatabaseHas('rider_profiles', [
            'id' => $riderId,
            'application_status' => 'submitted',
            'psgc_code' => $barangay->getKey(),
            'formatted_address' => 'Philippines, Test Region, Test Province, Test City, Test Barangay, 12 Test Street, 12',
        ]);
    }

    public function test_admin_can_review_and_approve_a_submitted_rider_application(): void
    {
        $user = RiderApplicationFixtures::user('review-applicant@example.test');
        $admin = RiderApplicationFixtures::admin('review-admin@example.test');
        $profile = RiderApplicationFixtures::submittedApplication($user);

        $this->asAdmin($admin)
            ->getJson('/api/v1/admin/applications?type=rider')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $profile->getKey());
        $this->postJson('/api/v1/admin/applications/rider/'.$profile->getKey().'/start-review')
            ->assertOk()
            ->assertJsonPath('data.application_status', 'under_review');
        $this->postJson('/api/v1/admin/applications/rider/'.$profile->getKey().'/approve', ['note' => 'Application reviewed.'])
            ->assertOk()
            ->assertJsonPath('data.profile.application_status', 'approved')
            ->assertJsonPath('data.profile.status', 'pending_activation')
            ->assertJsonPath('data.email_delivery.sent', true);

        $activationCode = null;
        Notification::assertSentTo($user, RiderActivationNotification::class, function (RiderActivationNotification $notification) use (&$activationCode): bool {
            $activationCode = $notification->code;

            return true;
        });
        $this->assertNotNull($activationCode);
        $this->assertDatabaseHas('rider_profiles', [
            'id' => $profile->getKey(),
            'application_status' => 'approved',
            'status' => 'pending_activation',
        ]);
    }

    public function test_rider_can_activate_through_the_owned_otp_endpoint(): void
    {
        $this->setOtpSettings();
        $user = RiderApplicationFixtures::user('activation-endpoint@example.test');
        $profile = RiderApplicationFixtures::pendingActivation($user);
        $code = app(AuthTokenService::class)->issueOtp($user, 'rider_activation', $user->email);

        $this->asCustomer($user)
            ->postJson('/api/v1/applications/riders/'.$profile->getKey().'/activation/verify', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('data.status', 'active');
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => 'rider_profile',
            'entity_id' => $profile->getKey(),
            'action' => 'rider_activation_verified',
        ]);
    }

    public function test_rejected_application_cannot_reapply_during_cooldown_and_old_documents_are_removed_afterward(): void
    {
        PlatformSetting::query()->updateOrCreate(
            ['setting_key' => 'rider_reapply_cooldown_days'],
            ['value' => json_encode(30, JSON_THROW_ON_ERROR)],
        );
        $user = RiderApplicationFixtures::user('cooldown-rider@example.test');
        $profile = RiderApplicationFixtures::rejectedApplication($user);
        $path = 'riders/'.$profile->getKey().'/documents/id_photo-'.str_repeat('e', 40).'.jpg';
        Storage::disk('private')->put($path, 'old private file');
        $document = RiderDocument::query()->create([
            'rider_id' => $profile->getKey(),
            'doc_type' => 'id_photo',
            'private_path' => $path,
        ]);

        $this->asCustomer($user)
            ->postJson('/api/v1/applications/riders')
            ->assertUnprocessable()
            ->assertJsonPath('error.fields.application.0', 'You may apply again after the 30-day rider cooling-off period.');

        $this->travel(31)->days();
        $this->asCustomer($user)
            ->postJson('/api/v1/applications/riders')
            ->assertOk()
            ->assertJsonPath('data.application_status', 'draft')
            ->assertJsonPath('data.documents', []);
        $this->assertDatabaseMissing('rider_documents', ['id' => $document->getKey()]);
        $this->assertFalse(Storage::disk('private')->exists($path));
        $this->travelBack();
    }

    public function test_rejected_document_pruning_obeys_retention_and_preserves_referenced_files(): void
    {
        PlatformSetting::query()->updateOrCreate(
            ['setting_key' => 'rejected_doc_retention_days'],
            ['value' => json_encode(30, JSON_THROW_ON_ERROR)],
        );
        $rejectedUser = RiderApplicationFixtures::user('retention-rejected@example.test');
        $rejectedProfile = RiderApplicationFixtures::rejectedApplication($rejectedUser);
        $rejectedProfile->forceFill(['updated_at' => now()->subDays(31)])->save();
        $expiredPath = 'riders/'.$rejectedProfile->getKey().'/documents/id_photo-'.str_repeat('f', 40).'.jpg';
        Storage::disk('private')->put($expiredPath, 'expired private file');
        $expiredDocument = RiderDocument::query()->create([
            'rider_id' => $rejectedProfile->getKey(),
            'doc_type' => 'id_photo',
            'private_path' => $expiredPath,
        ]);

        $activeUser = RiderApplicationFixtures::user('retention-active@example.test');
        $activeProfile = RiderApplicationFixtures::pendingActivation($activeUser);
        $activePath = 'riders/'.$activeProfile->getKey().'/documents/id_photo-'.str_repeat('g', 40).'.jpg';
        Storage::disk('private')->put($activePath, 'retained private file');
        $activeDocument = RiderDocument::query()->create([
            'rider_id' => $activeProfile->getKey(),
            'doc_type' => 'id_photo',
            'private_path' => $activePath,
        ]);

        $this->artisan('salo:prune-rider-documents')->assertExitCode(0);
        $this->assertDatabaseMissing('rider_documents', ['id' => $expiredDocument->getKey()]);
        $this->assertDatabaseHas('rider_documents', ['id' => $activeDocument->getKey()]);
        $this->assertFalse(Storage::disk('private')->exists($expiredPath));
        $this->assertTrue(Storage::disk('private')->exists($activePath));
    }

    private function asCustomer(User $user): static
    {
        Auth::forgetGuards();

        return $this->actingAs($user, 'web')
            ->withSession(['salo.active_mode' => 'customer'])
            ->withHeaders(['X-SALO-Mode' => 'customer']);
    }

    private function asAdmin(User $user): static
    {
        Auth::forgetGuards();

        return $this->actingAs($user, 'web')
            ->withSession(['salo.active_mode' => 'admin'])
            ->withHeaders(['X-SALO-Mode' => 'admin']);
    }

    private function setOtpSettings(): void
    {
        foreach ([
            'otp_validity_minutes' => 10,
            'otp_max_attempts' => 5,
            'otp_resend_cooldown_seconds' => 60,
        ] as $key => $value) {
            PlatformSetting::query()->updateOrCreate(
                ['setting_key' => $key],
                ['value' => json_encode($value, JSON_THROW_ON_ERROR)],
            );
        }
    }

    private function assertValidationFails(callable $callback): void
    {
        try {
            $callback();
            $this->fail('Expected validation to reject this activation request.');
        } catch (ValidationException) {
            $this->assertTrue(true);
        }
    }
}
