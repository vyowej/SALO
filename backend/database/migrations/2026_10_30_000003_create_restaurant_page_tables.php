<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cuisine_types', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 100)->unique();
            $table->boolean('is_filipino')->default(false);
            $table->timestamps();
        });

        Schema::create('restaurant_cuisines', function (Blueprint $table): void {
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->foreignId('cuisine_id')->constrained('cuisine_types')->restrictOnDelete();
            $table->primary(['restaurant_id', 'cuisine_id']);
        });

        Schema::create('restaurant_photos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->string('path', 255);
            $table->string('alt_text', 255)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->index(['restaurant_id', 'sort_order']);
        });

        Schema::create('operating_hours', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->unsignedTinyInteger('weekday');
            $table->time('open_time');
            $table->time('close_time');
            $table->boolean('crosses_midnight')->default(false);
            $table->unsignedTinyInteger('shift_order');
            $table->timestamps();
            $table->unique(['restaurant_id', 'weekday', 'shift_order'], 'operating_hours_restaurant_day_shift_unique');
            $table->index(['restaurant_id', 'weekday']);
        });

        Schema::create('closure_dates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->date('closure_date');
            $table->string('reason', 255);
            $table->timestamps();
            $table->unique(['restaurant_id', 'closure_date']);
            $table->index(['restaurant_id', 'closure_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('closure_dates');
        Schema::dropIfExists('operating_hours');
        Schema::dropIfExists('restaurant_photos');
        Schema::dropIfExists('restaurant_cuisines');
        Schema::dropIfExists('cuisine_types');
    }
};
