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
        'verified',
    ];

    protected function casts(): array
    {
        return [
            'expiry_date' => 'date',
            'verified' => 'boolean',
        ];
    }

    public function getVerificationStateAttribute(): string
    {
        return ($this->attributes['verified'] ?? false) ? 'verified' : 'pending';
    }

    public function setVerificationStateAttribute(string $state): void
    {
        if (! in_array($state, ['pending', 'verified'], true)) {
            throw new \InvalidArgumentException('Unsupported application document verification state.');
        }

        $this->attributes['verified'] = $state === 'verified';
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(RestaurantApplication::class, 'application_id');
    }
}
