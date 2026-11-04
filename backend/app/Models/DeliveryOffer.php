<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryOffer extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'delivery_id',
        'rider_id',
        'offered_at',
        'response',
        'responded_at',
    ];

    protected function casts(): array
    {
        return [
            'offered_at' => 'datetime',
            'responded_at' => 'datetime',
        ];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(RiderProfile::class, 'rider_id');
    }
}
