<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OperatingHour extends Model
{
    protected $fillable = [
        'restaurant_id',
        'weekday',
        'open_time',
        'close_time',
        'crosses_midnight',
        'shift_order',
    ];

    protected function casts(): array
    {
        return [
            'weekday' => 'integer',
            'crosses_midnight' => 'boolean',
            'shift_order' => 'integer',
        ];
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}
