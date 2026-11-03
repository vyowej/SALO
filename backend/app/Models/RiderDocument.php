<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderDocument extends Model
{
    public $timestamps = false;

    protected $fillable = ['rider_id', 'doc_type', 'private_path', 'verified'];

    protected function casts(): array
    {
        return ['verified' => 'boolean', 'created_at' => 'datetime'];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(RiderProfile::class, 'rider_id');
    }
}
