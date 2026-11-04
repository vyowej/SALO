<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'start_time', 'end_time'];

    public function capacities(): HasMany
    {
        return $this->hasMany(ZoneShiftCapacity::class, 'shift_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(RiderShiftAssignment::class, 'shift_id');
    }
}
