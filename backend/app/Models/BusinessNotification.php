<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessNotification extends Model
{
    protected $table = 'notifications';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'type',
        'message',
        'related_reference',
        'read_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
