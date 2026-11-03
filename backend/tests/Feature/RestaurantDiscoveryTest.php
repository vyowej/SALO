<?php

namespace Tests\Feature;

use App\Models\CuisineType;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthoritativeFixtures;
use Tests\TestCase;

class RestaurantDiscoveryTest extends TestCase
{
    use AuthoritativeFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->createAuthoritativeDietaryTag('vegetarian');
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173',
        ]);
    }

    public function test_guest_can_only_read_the_popular_restaurant_endpoint(): void
    {
        $this->getJson('/api/v1/restaurants/popular')
            ->assertOk()
            ->assertJsonPath('data', []);

        $this->getJson('/api/v1/restaurants')
            ->assertUnauthorized();
    }

    public function test_customer_listing_and_categories_include_only_approved_published_restaurants(): void
    {
        $customer = $this->createUser();
        $published = $this->createRestaurant('Visible Restaurant', 'approved', true);
        $inactive = $this->createRestaurant('Inactive Restaurant', 'inactive', true);
        $unpublished = $this->createRestaurant('Unpublished Restaurant', 'approved', false);
        $cuisine = CuisineType::query()->create(['name' => 'Filipino', 'is_filipino' => true]);
        $published->cuisines()->attach($cuisine->getKey());
        $inactive->cuisines()->attach($cuisine->getKey());
        $unpublished->cuisines()->attach($cuisine->getKey());

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/restaurants')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Visible Restaurant');

        $this->getJson('/api/v1/restaurants/categories')
            ->assertOk()
            ->assertJsonPath('data.categories', ['Filipino']);
    }

    public function test_menu_search_and_dietary_filters_return_only_published_matching_items(): void
    {
        $customer = $this->createUser();
        $restaurant = $this->createRestaurant('Menu Restaurant', 'approved', true);
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Mains',
            'sort_order' => 1,
            'status' => 'active',
        ]);
        $vegetarian = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Vegetable Bowl',
            'description' => 'A garden vegetable meal.',
            'price' => '250.00',
            'lifecycle_status' => 'published',
            'is_available' => true,
        ]);
        $draft = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Hidden Draft',
            'description' => 'Not public.',
            'price' => '100.00',
            'lifecycle_status' => 'draft',
            'is_available' => true,
        ]);
        $tag = \App\Models\DietaryTag::query()->where('name', 'vegetarian')->firstOrFail();
        $vegetarian->dietaryTags()->attach($tag->getKey());

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/restaurants/'.$restaurant->getKey().'/menu?q=Vegetable&dietary%5B%5D=vegetarian')
            ->assertOk()
            ->assertJsonPath('data.categories.0.items.0.name', 'Vegetable Bowl')
            ->assertJsonPath('data.categories.0.items.0.is_orderable', true)
            ->assertJsonMissing(['name' => 'Hidden Draft']);

        $this->assertNotSame($vegetarian->getKey(), $draft->getKey());
    }

    public function test_menu_item_dietary_tags_use_authoritative_pivot_columns_for_relationship_operations(): void
    {
        $restaurant = $this->createRestaurant('Dietary Pivot Restaurant', 'approved', true);
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Mains',
            'sort_order' => 1,
            'status' => 'active',
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Garden Bowl',
            'price' => '125.00',
            'lifecycle_status' => 'draft',
            'is_available' => false,
        ]);
        $vegetarian = $this->createAuthoritativeDietaryTag('vegetarian');
        $vegan = $this->createAuthoritativeDietaryTag('vegan');

        $item->dietaryTags()->attach($vegetarian->getKey());
        $this->assertDatabaseHas('menu_item_dietary_tags', [
            'item_id' => $item->getKey(),
            'tag_id' => $vegetarian->getKey(),
        ]);
        $this->assertSame(
            [$vegetarian->getKey()],
            $item->fresh()->load('dietaryTags')->dietaryTags->modelKeys(),
        );
        $this->assertTrue($vegetarian->items()->whereKey($item->getKey())->exists());

        $item->dietaryTags()->sync([$vegan->getKey()]);
        $this->assertDatabaseHas('menu_item_dietary_tags', [
            'item_id' => $item->getKey(),
            'tag_id' => $vegan->getKey(),
        ]);
        $this->assertDatabaseMissing('menu_item_dietary_tags', [
            'item_id' => $item->getKey(),
            'tag_id' => $vegetarian->getKey(),
        ]);

        $item->dietaryTags()->detach();
        $this->assertDatabaseMissing('menu_item_dietary_tags', ['item_id' => $item->getKey()]);
    }

    public function test_nearest_sort_requires_coordinates_and_rejects_out_of_bounds_coordinates(): void
    {
        $customer = $this->createUser();
        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/restaurants?sort=nearest')
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['latitude']]]);

        $this->getJson('/api/v1/restaurants?sort=nearest&latitude=0&longitude=0')
            ->assertUnprocessable()
            ->assertJsonStructure(['error' => ['fields' => ['latitude']]]);
    }

    public function test_open_now_filter_handles_regular_hours_overnight_hours_and_closures(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-03-16 01:00:00', 'Asia/Manila'));
        try {
            $customer = $this->createUser();
            $regular = $this->createRestaurant('Regular Hours', 'approved', true);
            $overnight = $this->createRestaurant('Overnight Hours', 'approved', true);
            $closed = $this->createRestaurant('Closed Today', 'approved', true);
            $regular->forceFill(['is_24_7' => false])->save();
            $overnight->forceFill(['is_24_7' => false])->save();
            $closed->forceFill(['is_24_7' => false])->save();

            DB::table('operating_hours')->insert([
                ['restaurant_id' => $regular->getKey(), 'weekday' => 1, 'open_time' => '00:00:00', 'close_time' => '03:00:00', 'crosses_midnight' => false, 'shift_order' => 1],
                ['restaurant_id' => $overnight->getKey(), 'weekday' => 7, 'open_time' => '22:00:00', 'close_time' => '02:00:00', 'crosses_midnight' => true, 'shift_order' => 1],
                ['restaurant_id' => $closed->getKey(), 'weekday' => 1, 'open_time' => '00:00:00', 'close_time' => '03:00:00', 'crosses_midnight' => false, 'shift_order' => 1],
            ]);
            DB::table('closure_dates')->insert([
                'restaurant_id' => $closed->getKey(),
                'closure_date' => '2026-03-16',
                'reason' => 'Closed for the day',
            ]);

            $response = $this->actingAs($customer, 'sanctum')
                ->getJson('/api/v1/restaurants?open_now=1')
                ->assertOk();

            $names = collect($response->json('data'))->pluck('name')->all();
            $this->assertContains('Regular Hours', $names);
            $this->assertContains('Overnight Hours', $names);
            $this->assertNotContains('Closed Today', $names);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_customer_favorites_are_persisted_and_scoped_to_the_authenticated_user(): void
    {
        $customer = $this->createUser();
        $otherCustomer = $this->createUser();
        $restaurant = $this->createRestaurant('Favorite Restaurant', 'approved', true);
        $category = MenuCategory::query()->create([
            'restaurant_id' => $restaurant->getKey(),
            'name' => 'Mains',
            'sort_order' => 1,
            'status' => 'active',
        ]);
        $item = MenuItem::query()->create([
            'category_id' => $category->getKey(),
            'name' => 'Favorite Dish',
            'price' => '250.00',
            'lifecycle_status' => 'published',
            'is_available' => true,
        ]);

        $this->actingAs($customer, 'sanctum')
            ->putJson('/api/v1/customer/favorites/restaurants/'.$restaurant->getKey(), [])
            ->assertOk()
            ->assertJsonPath('data.favorited', true);
        $this->putJson('/api/v1/customer/favorites/menu-items/'.$item->getKey(), [])
            ->assertOk()
            ->assertJsonPath('data.favorited', true);
        $this->getJson('/api/v1/customer/favorites?type=menu_item')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $item->getKey())
            ->assertJsonPath('data.0.type', 'menu_item');
        $this->assertDatabaseHas('favorite_restaurants', [
            'user_id' => $customer->getKey(),
            'restaurant_id' => $restaurant->getKey(),
        ]);

        $this->actingAs($otherCustomer, 'sanctum')
            ->getJson('/api/v1/customer/favorites')
            ->assertOk()
            ->assertJsonPath('data', []);

        $this->actingAs($customer, 'sanctum')
            ->deleteJson('/api/v1/customer/favorites/restaurants/'.$restaurant->getKey())
            ->assertOk()
            ->assertJsonPath('data.favorited', false);
    }

    private function createUser(): User
    {
        return User::query()->create([
            'email' => 'customer-'.uniqid().'@example.test',
            'password_hash' => 'Password123',
            'first_name' => 'Customer',
            'last_name' => 'Test',
            'status' => 'active',
        ]);
    }

    private function createRestaurant(string $name, string $status, bool $published): Restaurant
    {
        $owner = $this->createUser();

        return $this->createAuthoritativeRestaurant($owner, [
            'name' => $name,
            'status' => $status,
            'is_published' => $published,
        ]);
    }
}
