<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Delivery extends Model
{
    private ?int $terminalCleanupRiderId = null;

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

    protected static function booted(): void
    {
        static::updating(function (Delivery $delivery): void {
            if (! $delivery->isDirty('status')
                || ! in_array($delivery->status, ['delivered', 'failed', 'cancelled'], true)) {
                return;
            }

            $previousRiderId = $delivery->getRawOriginal('rider_id');
            $delivery->terminalCleanupRiderId = $previousRiderId === null
                ? ($delivery->rider_id === null ? null : (int) $delivery->rider_id)
                : (int) $previousRiderId;
        });

        static::updated(function (Delivery $delivery): void {
            if (! $delivery->wasChanged('status')
                || ! in_array($delivery->status, ['delivered', 'failed', 'cancelled'], true)) {
                return;
            }

            $riderId = $delivery->terminalCleanupRiderId;
            $delivery->terminalCleanupRiderId = null;
            if ($riderId === null) {
                return;
            }

            DB::afterCommit(
                fn () => app(\App\Services\RiderLocationCache::class)->forgetForRider($riderId, $delivery),
            );
        });
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
