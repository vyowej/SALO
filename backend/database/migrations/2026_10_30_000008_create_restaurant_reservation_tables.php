<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restaurant_tables', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->string('table_number', 80);
            $table->unsignedSmallInteger('capacity');
            $table->string('area', 120)->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->unique(['restaurant_id', 'table_number'], 'restaurant_tables_restaurant_number_unique');
            $table->index(['restaurant_id', 'status', 'capacity'], 'restaurant_tables_status_capacity_index');
        });

        Schema::create('reservation_settings', function (Blueprint $table): void {
            $table->foreignId('restaurant_id')->primary()->constrained('restaurants')->restrictOnDelete();
            $table->boolean('accepts_reservations')->default(false);
            $table->string('confirm_mode', 20)->default('manual');
            $table->unsignedSmallInteger('review_window_hours')->nullable();
            $table->unsignedSmallInteger('slot_minutes')->nullable();
            $table->unsignedSmallInteger('dining_minutes')->nullable();
            $table->unsignedSmallInteger('min_lead_hours')->nullable();
            $table->unsignedSmallInteger('max_months_ahead')->nullable();
            $table->unsignedSmallInteger('max_party_size')->nullable();
            $table->unsignedSmallInteger('grace_minutes')->nullable();
            $table->unsignedSmallInteger('cancel_cutoff_hours')->nullable();
            $table->timestamps();
        });

        Schema::create('reservations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('table_id')->constrained('restaurant_tables')->restrictOnDelete();
            $table->string('reference_code', 32)->unique();
            $table->timestamp('start_at');
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedSmallInteger('guest_count');
            $table->string('reserved_for_name', 160);
            $table->string('contact_phone', 32);
            $table->text('special_request')->nullable();
            $table->string('status', 20)->default('pending');
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('responded_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('response_reason', 500)->nullable();
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamps();
            $table->index(['table_id', 'start_at', 'status'], 'reservations_table_start_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservations');
        Schema::dropIfExists('reservation_settings');
        Schema::dropIfExists('restaurant_tables');
    }
};
