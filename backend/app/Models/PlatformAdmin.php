<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformAdmin extends Model
{
    protected $primaryKey = 'admin_id';

    public $timestamps = false;

    protected $fillable = ['user_id', 'admin_level', 'status'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
