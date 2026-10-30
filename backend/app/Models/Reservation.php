<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reservation extends Model
{
    protected $fillable = [
        'user_id',
        'table_id',
        'reference_code',
        'start_at',
        'duration_minutes',
        'guest_count',
        'reserved_for_name',
        'contact_phone',
        'special_request',
        'status',
        'expires_at',
        'responded_by',
        'cancelled_by',
        'response_reason',
        'cancel_reason',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'expires_at' => 'datetime',
            'duration_minutes' => 'integer',
            'guest_count' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(RestaurantTable::class, 'table_id');
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responded_by');
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}
