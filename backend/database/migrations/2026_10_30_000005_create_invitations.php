<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('restaurant_id')->constrained('restaurants')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('invited_by')->constrained('users')->restrictOnDelete();
            $table->string('invited_email', 254);
            $table->string('staff_role', 30);
            $table->string('token_hash', 64);
            $table->string('status', 20)->default('pending');
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->string('pending_invited_email', 254)
                ->nullable()
                ->virtualAs("CASE WHEN status = 'pending' THEN invited_email ELSE NULL END");
            $table->timestamps();
            $table->unique(['restaurant_id', 'pending_invited_email'], 'invitations_one_pending_email');
            $table->index(['user_id', 'status', 'expires_at']);
            $table->index(['restaurant_id', 'status', 'expires_at']);
            $table->unique('token_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
