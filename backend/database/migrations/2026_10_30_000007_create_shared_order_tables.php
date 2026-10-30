<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checkout_groups', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('reference_code', 32)->unique();
            $table->string('idempotency_key', 100)->nullable();
            $table->timestamp('placed_at');
            $table->timestamps();
            $table->unique(['user_id', 'idempotency_key'], 'checkout_groups_user_idempotency_unique');
        });

        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('checkout_group_id')->constrained('checkout_groups')->restrictOnDelete();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->string('reference_code', 32)->unique();
            $table->string('order_type', 20);
            $table->timestamp('scheduled_for')->nullable();
            $table->string('status', 30)->default('placed');
            $table->string('recipient_name', 160);
            $table->string('recipient_phone', 32);
            $table->text('delivery_address_text')->nullable();
            $table->decimal('delivery_lat', 10, 7)->nullable();
            $table->decimal('delivery_lng', 10, 7)->nullable();
            $table->decimal('subtotal', 10, 2);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('service_fee', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2);
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('cancel_reason', 500)->nullable();
            $table->timestamp('placed_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('customer_confirmed_at')->nullable();
            $table->string('confirmation_method', 30)->nullable();
            $table->timestamps();
            $table->index(['restaurant_id', 'status', 'placed_at'], 'orders_restaurant_status_placed_index');
            $table->index(['checkout_group_id', 'status'], 'orders_group_status_index');
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->restrictOnDelete();
            $table->foreignId('item_id')->constrained('menu_items')->restrictOnDelete();
            $table->string('item_name_snapshot', 160);
            $table->decimal('unit_price_snapshot', 10, 2);
            $table->unsignedSmallInteger('quantity');
            $table->string('note', 500)->nullable();
            $table->timestamps();
            $table->index('order_id');
        });

        Schema::create('order_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->restrictOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->string('reason', 500)->nullable();
            $table->timestamp('changed_at');
            $table->index(['order_id', 'changed_at'], 'order_status_history_order_changed_index');
        });

        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders')->restrictOnDelete();
            $table->string('method', 30);
            $table->string('status', 30)->default('unpaid');
            $table->decimal('amount', 10, 2);
            $table->string('provider', 80)->nullable();
            $table->string('provider_reference', 160)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_status_histories');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('checkout_groups');
    }
};
