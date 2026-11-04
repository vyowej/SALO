<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderShiftAssignment extends Model
{
    protected $fillable = [
        'rider_id',
        'zone_id',
        'shift_id',
        'status',
        'assigned_by',
        'assigned_by_user_id',
        'reason',
    ];

    public function rider(): BelongsTo
    {
        return $this->belongsTo(RiderProfile::class, 'rider_id');
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class, 'zone_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by_user_id');
    }
}
