<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Delivery extends Model
{
    protected $fillable = [
        'order_id',
        'rider_id',
        'status',
        'accepted_at',
        'picked_up_at',
        'delivered_at',
        'proof_photo_path',
        'proof_lat',
        'proof_lng',
        'distance_km',
        'rider_earning',
        'cash_collected',
        'cash_remitted',
    ];

    protected function casts(): array
    {
        return [
            'accepted_at' => 'datetime',
            'picked_up_at' => 'datetime',
            'delivered_at' => 'datetime',
            'cash_remitted' => 'boolean',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(RiderProfile::class, 'rider_id');
    }

    public function offers(): HasMany
    {
        return $this->hasMany(DeliveryOffer::class);
    }
}
