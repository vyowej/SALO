<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationDocument extends Model
{
    protected $fillable = [
        'application_id',
        'doc_type',
        'private_path',
        'expiry_date',
        'verification_state',
    ];

    protected function casts(): array
    {
        return ['expiry_date' => 'date'];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(RestaurantApplication::class, 'application_id');
    }
}
