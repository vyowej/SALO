<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClosureDate extends Model
{
    public $timestamps = false;

    protected $fillable = ['restaurant_id', 'closure_date', 'reason'];

    protected function casts(): array
    {
        return ['closure_date' => 'date'];
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }
}
