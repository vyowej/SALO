<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CheckoutGroup extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'reference_code',
        'idempotency_key',
        'placed_at',
    ];

    protected function casts(): array
    {
        return ['placed_at' => 'datetime'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'checkout_group_id');
    }
}
