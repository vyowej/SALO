<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $primaryKey = 'log_id';

    public $timestamps = false;

    protected $fillable = [
        'actor_user_id',
        'restaurant_id',
        'action',
        'entity_type',
        'entity_id',
        'before_value',
        'after_value',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'before_value' => 'array',
            'after_value' => 'array',
            'created_at' => 'datetime',
        ];
    }
}
