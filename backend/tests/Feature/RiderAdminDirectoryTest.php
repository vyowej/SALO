<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\RiderDocument;
use App\Models\RiderProfile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\URL;
use Tests\Support\RiderApplicationFixtures;
use Tests\Support\RiderDispatchFixtures;
use Tests\TestCase;

class RiderAdminDirectoryTest extends TestCase
{
    use RiderDispatchFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_directory_uses_approved_database_profiles_with_status_search_and_pagination(): void
    {
        $this->asAdmin();
        $profiles = [
            $this->approvedRider('directory-one@example.test', 'active', 'Directory', 'One'),
            $this->approvedRider('directory-two@example.test', 'pending_activation', 'Directory', 'Two'),
            $this->approvedRider('directory-three@example.test', 'suspended', 'Directory', 'Three'),
            $this->approvedRider('directory-four@example.test', 'resigned', 'Directory', 'Four'),
        ];
        RiderApplicationFixtures::submittedApplication(RiderApplicationFixtures::user('directory-review@example.test'));

        $page = $this->getJson('/api/v1/admin/riders?search=Directory&per_page=2&page=2')
            ->assertOk()
            ->assertJsonPath('meta.total', 4)
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.last_page', 2);
        $this->assertCount(2, $page->json('data'));
        $this->assertSame(
            ['approved', 'approved'],
            array_column($page->json('data'), 'application_status'),
        );
        $this->assertNotContains('00000000-0000-4000-8000-000000000103', array_column($page->json('data'), 'id'));

        $this->getJson('/api/v1/admin/riders?status=pending_activation')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $profiles[1]->getKey())
            ->assertJsonPath('data.0.application_status', 'approved')
            ->assertJsonPath('data.0.status', 'pending_activation');
        $this->getJson('/api/v1/admin/riders?search=directory-three@example.test&status=suspended')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $profiles[2]->getKey());
        $this->getJson('/api/v1/admin/riders?status=active')
            ->assertOk()
            ->assertJsonMissing(['id' => (string) $profiles[1]->getKey()]);
        $this->getJson('/api/v1/admin/riders?status=unknown')->assertUnprocessable();
    }

    public function test_rider_detail_and_status_actions_use_the_database_profile(): void
    {
        $this->asAdmin();
        $profile = $this->approvedRider('rider-detail@example.test', 'active', 'Actual', 'Rider');
        $documentPath = "riders/{$profile->getKey()}/documents/profile_photo-".str_repeat('a', 40).'.jpg';
        Storage::disk('private')->put($documentPath, 'private rider document');
        $document = RiderDocument::query()->create([
            'rider_id' => $profile->getKey(),
            'doc_type' => 'profile_photo',
            'private_path' => $documentPath,
        ]);

        $detail = $this->getJson('/api/v1/admin/riders/'.$profile->getKey())
            ->assertOk()
            ->assertJsonPath('data.id', (string) $profile->getKey())
            ->assertJsonPath('data.name', 'Actual Rider')
            ->assertJsonPath('data.email', 'rider-detail@example.test')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.application_status', 'approved')
            ->assertJsonPath('data.documents.0.id', (string) $document->getKey());
        $this->assertStringNotContainsString($documentPath, $detail->getContent());

        $this->patchJson('/api/v1/admin/riders/'.$profile->getKey().'/status', ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('data.id', (string) $profile->getKey())
            ->assertJsonPath('data.status', 'suspended');
        $this->assertDatabaseHas('rider_profiles', [
            'id' => $profile->getKey(),
            'status' => 'suspended',
        ]);
    }

    public function test_pending_activation_cannot_be_activated_or_suspended_from_the_directory(): void
    {
        $this->asAdmin();
        $profile = $this->approvedRider('pending-rider@example.test', 'pending_activation', 'Pending', 'Rider');

        $this->patchJson('/api/v1/admin/riders/'.$profile->getKey().'/status', ['status' => 'active'])
            ->assertStatus(409);
        $this->patchJson('/api/v1/admin/riders/'.$profile->getKey().'/status', ['status' => 'suspended'])
            ->assertStatus(409);
        $this->assertSame('pending_activation', $profile->fresh()->status);
    }

    public function test_delivery_proofs_are_database_backed_and_only_streamed_from_private_storage_for_admins(): void
    {
        $profile = $this->approvedRider('proof-rider@example.test', 'active', 'Proof', 'Rider');
        $proofPath = "riders/{$profile->getKey()}/proofs/".str_repeat('b', 40).'.jpg';
        Storage::fake('private');
        Storage::disk('private')->put($proofPath, base64_decode(
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IT//2Q==',
        ));
        $owner = RiderApplicationFixtures::user('proof-restaurant-owner@example.test');
        $barangay = RiderApplicationFixtures::barangay();
        $restaurant = $this->dispatchRestaurant($owner, $barangay->getKey());
        $order = $this->dispatchOrder(RiderApplicationFixtures::user('proof-customer@example.test'), $restaurant);
        $delivery = Delivery::query()->create([
            'order_id' => $order->getKey(),
            'rider_id' => $profile->getKey(),
            'status' => 'delivered',
            'delivered_at' => now(),
            'proof_photo_path' => $proofPath,
            'proof_lat' => '14.600000',
            'proof_lng' => '121.000000',
            'rider_earning' => '125.00',
        ]);

        $this->asAdmin();
        $this->getJson('/api/v1/admin/riders/'.$profile->getKey().'/proofs')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $delivery->getKey())
            ->assertJsonPath('data.0.delivery_id', (string) $delivery->getKey())
            ->assertJsonPath('data.0.order_number', $order->reference_code)
            ->assertJsonPath('data.0.stage', 'dropoff')
            ->assertJsonMissingPath('data.0.photo_ref')
            ->assertJsonMissingPath('data.0.proof_photo_path');
        $this->getJson('/api/v1/admin/riders?search=Proof%20Rider')
            ->assertOk()
            ->assertJsonPath('data.0.earnings.total', 125)
            ->assertJsonPath('data.0.earnings.this_week', 125)
            ->assertJsonPath('data.0.earnings.deliveries_count', 1);

        $urlResult = $this->getJson('/api/v1/admin/riders/'.$profile->getKey().'/proofs/'.$delivery->getKey().'/download-url')
            ->assertOk()
            ->assertJsonPath('data.expires_in_seconds', 300);
        $url = $urlResult->json('data.url');
        $this->assertStringContainsString('/private/delivery-proofs/'.$delivery->getKey(), $url);
        $pathAndQuery = parse_url($url, PHP_URL_PATH).'?'.parse_url($url, PHP_URL_QUERY);
        $this->get($pathAndQuery)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
    }

    public function test_rider_document_download_url_requires_an_admin_and_never_returns_storage_paths(): void
    {
        $profile = $this->approvedRider('document-rider@example.test', 'active', 'Document', 'Rider');
        $path = "riders/{$profile->getKey()}/documents/id_photo-".str_repeat('c', 40).'.jpg';
        Storage::fake('private');
        Storage::disk('private')->put($path, 'private rider document');
        $document = RiderDocument::query()->create([
            'rider_id' => $profile->getKey(),
            'doc_type' => 'id_photo',
            'private_path' => $path,
        ]);

        $this->asAdmin();
        $this->getJson("/api/v1/admin/riders/{$profile->getKey()}/documents/{$document->getKey()}/download-url")
            ->assertOk()
            ->assertJsonMissing(['private_path' => $path])
            ->assertJsonPath('data.expires_in_seconds', 300);

    }

    public function test_customers_cannot_access_rider_directory_or_private_rider_media(): void
    {
        $profile = $this->approvedRider('unauthorized-rider@example.test', 'active', 'Private', 'Rider');
        $customer = RiderApplicationFixtures::user('unauthorized-rider-viewer@example.test');
        $this->actingAs($customer, 'web')->withSession(['salo.active_mode' => 'customer']);

        $this->getJson('/api/v1/admin/riders')->assertForbidden();
        $this->getJson("/api/v1/admin/riders/{$profile->getKey()}/documents/1/download-url")
            ->assertForbidden();
        $signedUrl = URL::temporarySignedRoute(
            'api.v1.private-delivery-proofs.download',
            now()->addMinutes(5),
            ['delivery' => 1],
        );
        $this->get(parse_url($signedUrl, PHP_URL_PATH).'?'.parse_url($signedUrl, PHP_URL_QUERY))
            ->assertForbidden();
    }

    private function approvedRider(string $email, string $status, string $firstName, string $lastName): RiderProfile
    {
        $user = RiderApplicationFixtures::user($email);
        $user->forceFill([
            'first_name' => $firstName,
            'last_name' => $lastName,
        ])->save();
        $profile = RiderApplicationFixtures::pendingActivation($user);
        $profile->forceFill([
            'status' => $status,
            'availability' => $status === 'active' ? 'online' : 'offline',
            'resigned_at' => $status === 'resigned' ? now() : null,
        ])->save();

        return $profile;
    }

    private function asAdmin(): void
    {
        $admin = RiderApplicationFixtures::admin('rider-directory-admin-'.Str::random(10).'@example.test');
        $this->actingAs($admin, 'web')->withSession(['salo.active_mode' => 'admin']);
    }
}
