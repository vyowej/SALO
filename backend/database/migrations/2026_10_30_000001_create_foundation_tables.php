<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('email', 190)->unique();
            $table->string('password_hash');
            $table->string('first_name', 80);
            $table->string('middle_name', 80)->nullable();
            $table->string('last_name', 80);
            $table->string('suffix', 20)->nullable();
            $table->string('mobile', 20)->nullable();
            $table->date('birthday')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('platform_admins', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->restrictOnDelete();
            $table->string('admin_level', 30)->default('super');
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('auth_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('purpose', ['email_verification', 'business_email', 'rider_activation', 'email_change']);
            $table->char('token_hash', 64);
            $table->string('target_email', 190)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'purpose', 'target_email', 'used_at', 'expires_at'], 'auth_tokens_lookup_index');
            $table->index('expires_at');
        });

        Schema::create('psgc_locations', function (Blueprint $table): void {
            $table->string('code', 12)->primary();
            $table->string('parent_code', 12)->nullable();
            $table->string('name', 150);
            $table->enum('level', ['region', 'province', 'district', 'city', 'submunicipality', 'barangay']);
            $table->string('full_name', 300);
            $table->foreign('parent_code')->references('code')->on('psgc_locations')->restrictOnDelete();
            $table->index(['parent_code', 'name']);
            $table->index(['level', 'name']);
        });

        Schema::create('rider_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique('uq_rider_user')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->enum('application_status', ['draft', 'submitted', 'under_review', 'needs_revision', 'approved', 'rejected'])
                ->default('draft');
            $table->enum('status', ['pending_activation', 'active', 'suspended', 'resigned'])->nullable();
            $table->enum('availability', ['offline', 'online', 'busy'])->default('offline');
            $table->enum('vehicle_type', ['motorcycle', 'bicycle', 'e_scooter', 'walker'])->nullable();
            $table->string('plate_number', 20)->nullable();
            $table->char('country_code', 2)->default('PH');
            $table->string('psgc_code', 12)->nullable();
            $table->string('street', 190)->nullable();
            $table->string('house_no', 40)->nullable();
            $table->string('formatted_address', 300)->nullable();
            $table->decimal('home_lat', 9, 6)->nullable();
            $table->decimal('home_lng', 9, 6)->nullable();
            $table->string('ewallet_account_name', 120)->nullable();
            $table->boolean('declared_clearance_tin')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('resigned_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamps();
            $table->foreign('psgc_code')->references('code')->on('psgc_locations')->restrictOnDelete();
            $table->index(['status', 'availability'], 'idx_rider_dispatch');
        });

        Schema::create('platform_settings', function (Blueprint $table): void {
            $table->string('setting_key', 60)->primary();
            $table->string('value', 255);
            $table->foreignId('updated_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('updated_at')->useCurrent();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('restaurant_id')->nullable();
            $table->string('action', 60);
            $table->string('entity_type', 60);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('before_value')->nullable();
            $table->json('after_value')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['restaurant_id', 'created_at']);
            $table->index(['actor_user_id', 'created_at']);
            $table->index(['entity_type', 'entity_id', 'created_at'], 'audit_logs_entity_created_index');
        });

        Schema::create('notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 60);
            $table->string('message', 255);
            $table->string('related_reference', 60)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'read_at', 'created_at'], 'notifications_user_read_created_index');
            $table->index('related_reference');
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('platform_settings');
        Schema::dropIfExists('rider_profiles');
        Schema::dropIfExists('psgc_locations');
        Schema::dropIfExists('auth_tokens');
        Schema::dropIfExists('platform_admins');
        Schema::dropIfExists('users');
    }
};
