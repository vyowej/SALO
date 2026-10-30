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
            $table->string('email', 254)->unique();
            $table->string('password');
            $table->string('first_name', 80);
            $table->string('middle_name', 80)->nullable();
            $table->string('last_name', 80);
            $table->string('suffix', 20)->nullable();
            $table->string('mobile', 32)->nullable();
            $table->date('birthday')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('platform_admins', function (Blueprint $table): void {
            $table->id('admin_id');
            $table->foreignId('user_id')->unique()->constrained('users')->restrictOnDelete();
            $table->string('admin_level', 30)->default('super');
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('auth_tokens', function (Blueprint $table): void {
            $table->id('token_id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('purpose', 40);
            $table->string('token_hash', 255);
            $table->string('target_email', 254)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'purpose', 'target_email', 'used_at', 'expires_at'], 'auth_tokens_lookup_index');
            $table->index('expires_at');
        });

        Schema::create('psgc_locations', function (Blueprint $table): void {
            $table->string('code', 10)->primary();
            $table->string('parent_code', 10)->nullable();
            $table->string('name', 160);
            $table->string('level', 20);
            $table->foreign('parent_code')->references('code')->on('psgc_locations')->nullOnDelete();
            $table->index(['parent_code', 'name']);
            $table->index(['level', 'name']);
        });

        Schema::create('platform_settings', function (Blueprint $table): void {
            $table->string('setting_key', 100)->primary();
            $table->json('value');
            $table->unsignedBigInteger('updated_by');
            $table->timestamp('updated_at')->useCurrent();
            $table->foreign('updated_by')->references('admin_id')->on('platform_admins')->restrictOnDelete();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id('log_id');
            $table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('restaurant_id')->nullable();
            $table->string('action', 100);
            $table->string('entity_type', 80);
            $table->string('entity_id', 100);
            $table->json('before_value')->nullable();
            $table->json('after_value')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['restaurant_id', 'created_at']);
            $table->index(['actor_user_id', 'created_at']);
            $table->index(['entity_type', 'entity_id', 'created_at'], 'audit_logs_entity_created_index');
        });

        Schema::create('notifications', function (Blueprint $table): void {
            $table->id('notification_id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 100);
            $table->text('message');
            $table->string('related_reference', 160)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'read_at', 'created_at'], 'notifications_user_read_created_index');
            $table->index('related_reference');
        });

        Schema::create('sessions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('platform_settings');
        Schema::dropIfExists('psgc_locations');
        Schema::dropIfExists('auth_tokens');
        Schema::dropIfExists('platform_admins');
        Schema::dropIfExists('users');
    }
};
