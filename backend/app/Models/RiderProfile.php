<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderProfile extends Model
{
    protected $fillable = [
        'user_id',
        'approved_by',
        'application_status',
        'status',
        'availability',
        'vehicle_type',
        'plate_number',
        'country_code',
        'psgc_code',
        'street',
        'house_no',
        'formatted_address',
        'home_lat',
        'home_lng',
        'ewallet_account_name',
        'declared_clearance_tin',
        'submitted_at',
        'approved_at',
        'resigned_at',
        'review_notes',
    ];

    protected function casts(): array
    {
        return [
            'home_lat' => 'decimal:6',
            'home_lng' => 'decimal:6',
            'declared_clearance_tin' => 'boolean',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'resigned_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(PsgcLocation::class, 'psgc_code', 'code');
    }
}
