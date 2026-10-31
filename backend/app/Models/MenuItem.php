<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class MenuItem extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'description',
        'price',
        'image_path',
        'lifecycle_status',
        'is_available',
        'daily_quantity',
        'quantity_left',
        'prep_minutes',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_available' => 'boolean',
            'daily_quantity' => 'integer',
            'quantity_left' => 'integer',
            'prep_minutes' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(MenuCategory::class, 'category_id');
    }

    public function dietaryTags(): BelongsToMany
    {
        return $this->belongsToMany(DietaryTag::class, 'menu_item_dietary_tags', 'menu_item_id', 'dietary_tag_id');
    }
}
