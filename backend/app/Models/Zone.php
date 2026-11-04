<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'psgc_code',
        'name',
        'center_lat',
        'center_lng',
        'radius_km',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'center_lat' => 'decimal:6',
            'center_lng' => 'decimal:6',
            'radius_km' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function capacities(): HasMany
    {
        return $this->hasMany(ZoneShiftCapacity::class, 'zone_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(RiderShiftAssignment::class, 'zone_id');
    }
}
