<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestaurantApplication extends Model
{
    protected $fillable = [
        'restaurant_id',
        'submitted_by',
        'reviewed_by',
        'application_type',
        'status',
        'draft_details',
        'proposed_changes',
        'declared_bir_2303',
        'submitted_at',
        'reviewed_at',
        'review_notes',
    ];

    protected function casts(): array
    {
        return [
            'draft_details' => 'array',
            'proposed_changes' => 'array',
            'declared_bir_2303' => 'boolean',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ApplicationDocument::class, 'application_id');
    }
}
