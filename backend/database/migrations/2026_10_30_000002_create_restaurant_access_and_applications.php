<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restaurants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->restrictOnDelete();
            $table->string('name', 160);
            $table->string('branch_label', 100)->nullable();
            $table->text('description')->nullable();
            $table->string('legal_name', 160)->nullable();
            $table->string('contact_number', 40)->nullable();
            $table->string('business_email', 254)->nullable();
            $table->timestamp('business_email_verified_at')->nullable();
            $table->string('psgc_code', 10)->nullable();
            $table->string('street', 255)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('logo_path', 255)->nullable();
            $table->string('cover_path', 255)->nullable();
            $table->decimal('delivery_radius_km', 6, 2)->nullable();
            $table->unsignedSmallInteger('prep_minutes')->nullable();
            $table->boolean('is_24_7')->default(false);
            $table->string('status', 20)->default('approved')->index();
            $table->boolean('is_published')->default(false)->index();
            $table->timestamps();
            $table->foreign('psgc_code')->references('code')->on('psgc_locations')->restrictOnDelete();
        });

        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->foreign('restaurant_id')->references('id')->on('restaurants')->restrictOnDelete();
        });

        Schema::create('restaurant_staff', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('staff_role', 30);
            $table->string('status', 20)->default('invited')->index();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
            $table->unique(['restaurant_id', 'user_id']);
            $table->index(['restaurant_id', 'status']);
        });

        Schema::create('restaurant_applications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->nullable()->constrained('restaurants')->restrictOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('application_type', 30)->default('initial');
            $table->string('status', 30)->default('draft')->index();
            $table->json('draft_details')->nullable();
            $table->json('proposed_changes')->nullable();
            $table->boolean('declared_bir_2303')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->unsignedBigInteger('pending_sensitive_update_restaurant_id')
                ->nullable()
                ->virtualAs("CASE WHEN application_type = 'sensitive_update' AND status IN ('draft', 'submitted', 'under_review', 'needs_revision') THEN restaurant_id ELSE NULL END");
            $table->timestamps();
            $table->index(['submitted_by', 'status', 'created_at'], 'restaurant_applications_owner_status_index');
            $table->index(['application_type', 'status', 'submitted_at'], 'restaurant_applications_queue_index');
            $table->unique('pending_sensitive_update_restaurant_id', 'restaurant_applications_one_pending_sensitive_update');
        });

        Schema::create('application_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('application_id')->constrained('restaurant_applications')->restrictOnDelete();
            $table->string('doc_type', 40);
            $table->string('private_path', 255);
            $table->date('expiry_date')->nullable();
            $table->string('verification_state', 20)->default('pending');
            $table->timestamps();
            $table->index(['application_id', 'doc_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_documents');
        Schema::dropIfExists('restaurant_applications');
        Schema::dropIfExists('restaurant_staff');
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropForeign(['restaurant_id']);
        });
        Schema::dropIfExists('restaurants');
    }
};
