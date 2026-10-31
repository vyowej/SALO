<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReservationSetting extends Model
{
    protected $primaryKey = 'restaurant_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'restaurant_id',
        'accepts_reservations',
        'confirm_mode',
        'review_window_hours',
        'slot_minutes',
        'dining_minutes',
        'min_lead_hours',
        'max_months_ahead',
        'max_party_size',
        'grace_minutes',
        'cancel_cutoff_hours',
    ];

    protected function casts(): array
    {
        return [
            'accepts_reservations' => 'boolean',
            'review_window_hours' => 'integer',
            'slot_minutes' => 'integer',
            'dining_minutes' => 'integer',
            'min_lead_hours' => 'integer',
            'max_months_ahead' => 'integer',
            'max_party_size' => 'integer',
            'grace_minutes' => 'integer',
            'cancel_cutoff_hours' => 'integer',
        ];
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}
