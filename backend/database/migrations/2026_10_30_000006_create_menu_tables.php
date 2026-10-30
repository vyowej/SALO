<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('menu_categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->string('name', 120);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->unique(['restaurant_id', 'name']);
            $table->index(['restaurant_id', 'status', 'sort_order']);
        });

        Schema::create('menu_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('category_id')->constrained('menu_categories')->restrictOnDelete();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->string('image_path', 255)->nullable();
            $table->string('lifecycle_status', 20)->default('draft');
            $table->boolean('is_available')->default(true);
            $table->unsignedInteger('daily_quantity')->nullable();
            $table->unsignedInteger('quantity_left')->nullable();
            $table->unsignedSmallInteger('prep_minutes')->nullable();
            $table->timestamps();
            $table->index(['category_id', 'lifecycle_status', 'is_available']);
        });

        Schema::create('dietary_tags', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 60)->unique();
            $table->string('tag_type', 20);
        });

        Schema::create('menu_item_dietary_tags', function (Blueprint $table): void {
            $table->foreignId('menu_item_id')->constrained('menu_items')->restrictOnDelete();
            $table->foreignId('dietary_tag_id')->constrained('dietary_tags')->restrictOnDelete();
            $table->primary(['menu_item_id', 'dietary_tag_id']);
        });

        DB::table('dietary_tags')->insert([
            ['name' => 'contains_pork', 'tag_type' => 'dietary'],
            ['name' => 'halal_certified', 'tag_type' => 'dietary'],
            ['name' => 'vegetarian', 'tag_type' => 'dietary'],
            ['name' => 'vegan', 'tag_type' => 'dietary'],
            ['name' => 'contains_peanuts', 'tag_type' => 'allergen'],
            ['name' => 'contains_tree_nuts', 'tag_type' => 'allergen'],
            ['name' => 'contains_dairy', 'tag_type' => 'allergen'],
            ['name' => 'contains_eggs', 'tag_type' => 'allergen'],
            ['name' => 'contains_soy', 'tag_type' => 'allergen'],
            ['name' => 'contains_wheat', 'tag_type' => 'allergen'],
            ['name' => 'contains_shellfish', 'tag_type' => 'allergen'],
            ['name' => 'contains_fish', 'tag_type' => 'allergen'],
            ['name' => 'contains_sesame', 'tag_type' => 'allergen'],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('menu_item_dietary_tags');
        Schema::dropIfExists('dietary_tags');
        Schema::dropIfExists('menu_items');
        Schema::dropIfExists('menu_categories');
    }
};
