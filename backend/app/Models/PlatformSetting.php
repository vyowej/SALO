<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformSetting extends Model
{
    protected $primaryKey = 'setting_key';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = ['setting_key', 'value', 'updated_by', 'updated_at'];

    protected function casts(): array
    {
        return ['updated_at' => 'datetime'];
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
