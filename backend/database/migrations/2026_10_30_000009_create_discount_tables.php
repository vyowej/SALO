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
            $table->string('funded_by', 20);
            $table->string('code', 64);
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->string('type', 24);
            $table->boolean('first_order_only')->default(false);
            $table->decimal('value', 10, 2)->default(0);
            $table->decimal('min_order_amount', 10, 2)->default(0);
            $table->decimal('max_discount', 10, 2)->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedSmallInteger('per_customer_limit')->default(1);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('scope_restaurant_id')->storedAs('COALESCE(restaurant_id, 0)');
            $table->string('normalized_code', 64)->storedAs('LOWER(code)');
            $table->timestamps();
            $table->unique(['scope_restaurant_id', 'normalized_code'], 'discounts_scope_code_unique');
            $table->index(['restaurant_id', 'is_active', 'starts_at', 'ends_at'], 'discounts_restaurant_active_dates_index');
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
