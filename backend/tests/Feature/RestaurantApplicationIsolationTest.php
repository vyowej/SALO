<?php

namespace Tests\Feature;

use App\Models\ApplicationDocument;
use App\Models\PlatformAdmin;
use App\Models\Restaurant;
use App\Models\RestaurantApplication;
use App\Models\User;
use Illuminate\Support\Facades\URL;

class RestaurantApplicationIsolationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ]);
    }

    public function test_another_user_cannot_read_an_application_or_its_private_documents(): void
    {
        $applicant = $this->createUser('applicant@example.test');
        $otherUser = $this->createUser('other@example.test');
        $application = RestaurantApplication::query()->create([
            'submitted_by' => $applicant->getKey(),
            'application_type' => 'initial',
            'status' => 'submitted',
            'draft_details' => ['restaurant_name' => 'Applicant Restaurant'],
            'submitted_at' => now(),
        ]);
        $document = ApplicationDocument::query()->create([
            'application_id' => $application->getKey(),
            'doc_type' => 'business_permit',
            'private_path' => 'application-documents/private.pdf',
            'verification_state' => 'pending',
        ]);

        $this->actingAs($otherUser, 'web')
            ->getJson('/api/v1/applications/restaurants/'.$application->getKey())
            ->assertNotFound();

        $this->getJson('/api/v1/applications/documents/'.$document->getKey().'/download-url')
            ->assertNotFound();

        $signedUrl = URL::temporarySignedRoute(
            'api.v1.private-documents.download',
            now()->addMinutes(5),
            ['document' => $document->getKey()],
        );
        $this->getJson($signedUrl)->assertNotFound();
    }

    public function test_approving_an_initial_application_twice_creates_only_one_restaurant(): void
    {
        $applicant = $this->createUser('owner@example.test');
        $admin = $this->createUser('admin@example.test');
        PlatformAdmin::query()->create([
            'user_id' => $admin->getKey(),
            'admin_level' => 'super',
            'status' => 'active',
        ]);
        $application = RestaurantApplication::query()->create([
            'submitted_by' => $applicant->getKey(),
            'application_type' => 'initial',
            'status' => 'under_review',
            'draft_details' => [
                'restaurant_name' => 'Only One Restaurant',
                'category' => 'Filipino',
                'description' => 'A test restaurant.',
                'contact_number' => '09171234567',
                'business_email' => 'business@example.test',
                'business_email_verified_at' => now()->toISOString(),
                'psgc_code' => null,
                'street' => '1 Test Street',
                'latitude' => 14.5995,
                'longitude' => 120.9842,
                'is_24_7' => false,
            ],
        ]);

        $this->actingAs($admin, 'web')
            ->withSession(['salo.active_mode' => 'admin'])
            ->postJson('/api/v1/admin/applications/restaurant/'.$application->getKey().'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->postJson('/api/v1/admin/applications/restaurant/'.$application->getKey().'/approve')
            ->assertUnprocessable();

        $this->assertSame(1, Restaurant::query()->where('owner_user_id', $applicant->getKey())->count());
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password' => 'Password123',
            'first_name' => 'Test',
            'last_name' => 'User',
            'status' => 'active',
        ]);
    }
}
