<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->nullable()->constrained('restaurants')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->enum('funded_by', ['platform', 'restaurant'])->default('restaurant');
            $table->string('code', 40);
            $table->string('name', 120);
            $table->string('description', 255)->nullable();
            $table->enum('type', ['percentage', 'fixed', 'free_delivery', 'first_order']);
            $table->decimal('value', 10, 2)->default(0);
            $table->decimal('min_order_amount', 10, 2)->default(0);
            $table->decimal('max_discount', 10, 2)->nullable();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('per_customer_limit')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('scope_key')->storedAs('COALESCE(restaurant_id, 0)');
            $table->timestamp('created_at')->nullable()->useCurrent();
            $table->timestamp('updated_at')->nullable()->useCurrent()->useCurrentOnUpdate();
            $table->unique(['scope_key', 'code'], 'uq_discount_code');
            $table->index(['restaurant_id', 'is_active', 'ends_at'], 'idx_disc_rest');
        });

        Schema::create('discount_redemptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('discount_id')->constrained('discounts')->restrictOnDelete();
            $table->foreignId('order_id')->unique()->constrained('orders')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->decimal('amount_applied', 10, 2);
            $table->string('status', 20)->default('applied');
            $table->timestamps();
            $table->index(['discount_id', 'status', 'created_at'], 'discount_redemptions_usage_index');
            $table->index(['user_id', 'discount_id', 'status'], 'discount_redemptions_customer_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_redemptions');
        Schema::dropIfExists('discounts');
    }
};
