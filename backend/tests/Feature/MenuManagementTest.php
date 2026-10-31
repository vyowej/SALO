<?php

namespace Tests\Feature;

use App\Models\DietaryTag;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\OperatingHour;
use App\Models\Restaurant;
use App\Models\RestaurantApplication;
use App\Models\RestaurantStaff;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class MenuManagementTest extends \Tests\TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173']);
    }

    public function test_owner_can_manage_categories_and_items_and_price_change_requires_confirmation(): void
    {
        Storage::fake('public');
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $request = $this->businessRequest($owner, $restaurant);

        $categoryResponse = $request->postJson($this->menuPath($restaurant, '/categories'), [
            'name' => 'Main dishes',
            'sort_order' => 1,
        ])->assertOk()->assertJsonPath('data.category.name', 'Main dishes');
        $categoryId = $categoryResponse->json('data.category.id');
        $vegetarian = DietaryTag::query()->where('name', 'vegetarian')->firstOrFail();

        $itemData = [
            'category_id' => $categoryId,
            'name' => 'Vegetable curry',
            'description' => 'A sample item.',
            'price' => '125.00',
            'lifecycle_status' => 'published',
            'dietary_tag_ids' => [$vegetarian->getKey()],
            'daily_quantity' => 4,
        ];
        $request->postJson($this->menuPath($restaurant, '/items'), $itemData)
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['file']]]);
        $this->assertSame(0, MenuItem::query()->count());

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rWQAAAAASUVORK5CYII=', true);
        $itemResponse = $request->post($this->menuPath($restaurant, '/items'), array_merge($itemData, [
            'file' => UploadedFile::fake()->createWithContent('menu.png', $png),
        ]), ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.item.is_orderable', true);
        $itemId = $itemResponse->json('data.item.id');
        $createdItem = MenuItem::query()->findOrFail($itemId);
        $this->assertNotEmpty($createdItem->image_path);
        $this->assertNotEmpty($itemResponse->json('data.item.image_url'));
        Storage::disk('public')->assertExists($createdItem->image_path);

        $request->patchJson($this->menuPath($restaurant, '/items/'.$itemId), [
            'price' => '130.00',
        ])->assertUnprocessable()->assertJsonStructure(['error' => ['fields' => ['price_change_acknowledged']]]);

        $request->patchJson($this->menuPath($restaurant, '/items/'.$itemId), [
            'price' => '130.00',
            'price_change_acknowledged' => true,
        ])->assertOk()->assertJsonPath('data.item.price', '130.00');

        $request->getJson($this->businessPath($restaurant, '/publish-checklist'))
            ->assertOk()
            ->assertJsonPath('data.checks.orderable_item.complete', true);

        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'menu.item.updated',
            'entity_id' => (string) $itemId,
        ]);
    }

    public function test_staff_can_toggle_availability_but_cannot_manage_menu_content(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Drinks',
            'sort_order' => 0,
            'status' => 'active',
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Water',
            'price' => '10.00',
            'lifecycle_status' => 'published',
            'is_available' => true,
        ]);
        $staff = $this->createUser('staff-'.uniqid().'@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $staff->getKey(),
            'staff_role' => 'staff',
            'status' => 'active',
            'joined_at' => now(),
        ]);
        $manager = $this->createUser('manager-'.uniqid().'@example.test');
        RestaurantStaff::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'user_id' => $manager->getKey(),
            'staff_role' => 'manager',
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->businessRequest($manager, $restaurant)
            ->postJson($this->menuPath($restaurant, '/categories'), ['name' => 'Sides'])
            ->assertOk()
            ->assertJsonPath('data.category.name', 'Sides');

        $this->businessRequest($staff, $restaurant)
            ->patchJson($this->menuPath($restaurant, '/items/'.$item->getKey().'/availability'), [
                'is_available' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.item.is_available', false);

        $this->businessRequest($staff, $restaurant)
            ->patchJson($this->menuPath($restaurant, '/items/'.$item->getKey()), [
                'name' => 'Changed by staff',
            ])
            ->assertForbidden();

        $this->assertSame('Water', $item->fresh()->name);
    }

    public function test_bulk_publish_reports_items_outside_the_restaurant_without_updating_them(): void
    {
        [$owner, $restaurantA] = $this->createOwnerAndRestaurant();
        [, $restaurantB] = $this->createOwnerAndRestaurant();
        $categoryA = MenuCategory::query()->create([
            'restaurant_id' => $restaurantA->getKey(),
            'name' => 'A category',
            'status' => 'active',
        ]);
        $categoryB = MenuCategory::query()->create([
            'restaurant_id' => $restaurantB->getKey(),
            'name' => 'B category',
            'status' => 'active',
        ]);
        $itemA = MenuItem::query()->create([
            'category_id' => $categoryA->getKey(),
            'name' => 'Local item',
            'price' => '20.00',
            'lifecycle_status' => 'draft',
            'is_available' => true,
        ]);
        $itemB = MenuItem::query()->create([
            'category_id' => $categoryB->getKey(),
            'name' => 'Foreign item',
            'price' => '30.00',
            'lifecycle_status' => 'draft',
            'is_available' => true,
        ]);

        $response = $this->businessRequest($owner, $restaurantA)
            ->postJson($this->menuPath($restaurantA, '/items/bulk-publish'), [
                'item_ids' => [$itemA->getKey(), $itemB->getKey()],
            ])
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonCount(1, 'data.failures');

        $this->assertSame('published', $itemA->fresh()->lifecycle_status);
        $this->assertSame('draft', $itemB->fresh()->lifecycle_status);
        $this->assertSame((string) $itemB->getKey(), $response->json('data.failures.0.item_id'));
    }

    public function test_nested_menu_resources_cannot_be_moved_across_restaurants(): void
    {
        [$ownerA, $restaurantA] = $this->createOwnerAndRestaurant();
        [$ownerB, $restaurantB] = $this->createOwnerAndRestaurant();
        $categoryA = MenuCategory::query()->create([
            'restaurant_id' => $restaurantA->getKey(),
            'name' => 'A category',
            'status' => 'active',
        ]);
        $categoryB = MenuCategory::query()->create([
            'restaurant_id' => $restaurantB->getKey(),
            'name' => 'B category',
            'status' => 'active',
        ]);
        $itemA = MenuItem::query()->create([
            'category_id' => $categoryA->getKey(),
            'name' => 'A item',
            'price' => '20.00',
            'lifecycle_status' => 'draft',
            'is_available' => true,
        ]);

        $this->businessRequest($ownerA, $restaurantA)
            ->patchJson($this->menuPath($restaurantA, '/items/'.$itemA->getKey()), [
                'category_id' => $categoryB->getKey(),
            ])
            ->assertNotFound();

        $this->businessRequest($ownerA, $restaurantA)
            ->patchJson($this->menuPath($restaurantA, '/items/'.$itemA->getKey().'/availability'), [
                'is_available' => false,
            ])
            ->assertOk();
        $this->assertSame($categoryA->getKey(), $itemA->fresh()->category_id);
    }

    public function test_archiving_a_category_with_published_items_is_rejected(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Meals',
            'status' => 'active',
        ]);
        MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Lunch',
            'price' => '75.00',
            'lifecycle_status' => 'published',
            'is_available' => true,
        ]);

        $this->businessRequest($owner, $restaurant)
            ->deleteJson($this->menuPath($restaurant, '/categories/'.$category->getKey()))
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['status']]]);

        $this->assertSame('active', $category->fresh()->status);
    }

    public function test_halal_label_requires_a_valid_private_certificate(): void
    {
        Storage::fake('private');
        Storage::fake('public');
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $application = RestaurantApplication::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'submitted_by' => $owner->getKey(),
            'application_type' => 'initial',
            'status' => 'approved',
        ]);
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Certified food',
            'status' => 'active',
        ]);
        $halalTag = DietaryTag::query()->where('name', 'halal_certified')->firstOrFail();

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rWQAAAAASUVORK5CYII=', true);
        $this->businessRequest($owner, $restaurant)
            ->post($this->menuPath($restaurant, '/items'), [
                'category_id' => $category->getKey(),
                'name' => 'Halal meal',
                'price' => '90.00',
                'dietary_tag_ids' => [$halalTag->getKey()],
                'file' => UploadedFile::fake()->createWithContent('menu.png', $png),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['dietary_tag_ids']]]);
        $this->assertSame([], Storage::disk('public')->allFiles());

        $this->businessRequest($owner, $restaurant)
            ->post($this->menuPath($restaurant, '/halal-certificate'), [
                'file' => UploadedFile::fake()->createWithContent('halal.pdf', "%PDF-1.4\nSALO test certificate\n%%EOF"),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.halal_certificate_available', false);

        $this->assertDatabaseHas('application_documents', [
            'application_id' => $application->getKey(),
            'doc_type' => 'halal_certificate',
            'verified' => false,
        ]);
    }

    public function test_menu_photo_is_stored_on_the_public_disk_and_audited(): void
    {
        Storage::fake('public');
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Photos',
            'status' => 'active',
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Sample item',
            'price' => '25.00',
            'lifecycle_status' => 'draft',
            'is_available' => true,
        ]);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rWQAAAAASUVORK5CYII=', true);

        $this->businessRequest($owner, $restaurant)
            ->post($this->menuPath($restaurant, '/items/'.$item->getKey().'/photo'), [
                'file' => UploadedFile::fake()->createWithContent('menu.png', $png),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.item.id', (string) $item->getKey());

        $this->assertNotEmpty($item->fresh()->image_path);
        Storage::disk('public')->assertExists($item->fresh()->image_path);
        $this->assertDatabaseHas('audit_logs', [
            'restaurant_id' => $restaurant->getKey(),
            'action' => 'menu.item.photo_changed',
            'entity_id' => (string) $item->getKey(),
        ]);
    }

    public function test_menu_photo_rejects_unsupported_oversized_and_fake_mime_uploads(): void
    {
        Storage::fake('public');
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Uploads',
            'status' => 'active',
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Sample item',
            'price' => '25.00',
            'lifecycle_status' => 'draft',
            'is_available' => true,
        ]);
        $path = $this->menuPath($restaurant, '/items/'.$item->getKey().'/photo');

        $this->businessRequest($owner, $restaurant)
            ->post($path, ['file' => UploadedFile::fake()->create('menu.gif', 10, 'image/gif')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['file']]]);
        $this->businessRequest($owner, $restaurant)
            ->post($path, ['file' => UploadedFile::fake()->create('large.png', 2049, 'image/png')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['file']]]);
        $this->businessRequest($owner, $restaurant)
            ->post($path, ['file' => UploadedFile::fake()->createWithContent('fake.png', 'not an actual PNG')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['file']]]);

        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_daily_quantity_reset_uses_the_first_shift_opening_time(): void
    {
        [$owner, $restaurant] = $this->createOwnerAndRestaurant();
        $restaurant->forceFill(['is_24_7' => false])->save();
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Breakfast',
            'status' => 'active',
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Pancakes',
            'price' => '100.00',
            'lifecycle_status' => 'published',
            'is_available' => true,
            'daily_quantity' => 5,
            'quantity_left' => 0,
        ]);
        OperatingHour::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'weekday' => 5,
            'open_time' => '09:00:00',
            'close_time' => '17:00:00',
            'crosses_midnight' => false,
            'shift_order' => 1,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-30 09:00:00', 'Asia/Manila'));
        try {
            $this->artisan('salo:reset-menu-quantities')->assertExitCode(0);
        } finally {
            Carbon::setTestNow();
        }

        $this->assertSame(5, $item->fresh()->quantity_left);
    }

    private function createOwnerAndRestaurant(): array
    {
        $owner = $this->createUser('owner-'.uniqid().'@example.test');
        $restaurant = Restaurant::query()->create([
            'owner_user_id' => $owner->getKey(),
            'name' => 'Test Restaurant',
            'status' => 'approved',
            'is_24_7' => true,
        ]);

        return [$owner, $restaurant];
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password_hash' => 'Password123',
            'first_name' => 'Menu',
            'last_name' => 'Tester',
            'status' => 'active',
        ]);
    }

    private function businessRequest(User $user, Restaurant $restaurant): self
    {
        return $this->actingAs($user, 'web')
            ->withSession([
                'salo.active_mode' => 'business',
                'salo.selected_restaurant_id' => (string) $restaurant->getKey(),
            ])
            ->withHeaders([
                'X-SALO-Mode' => 'business',
                'X-SALO-Restaurant' => (string) $restaurant->getKey(),
            ]);
    }

    private function menuPath(Restaurant $restaurant, string $suffix = ''): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/menu'.$suffix;
    }

    private function businessPath(Restaurant $restaurant, string $suffix): string
    {
        return '/api/v1/manage/restaurants/'.$restaurant->getKey().'/business'.$suffix;
    }
}
