<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class DietaryTag extends Model
{
    public $timestamps = false;

    protected $fillable = ['name', 'tag_type'];

    public function items(): BelongsToMany
    {
        return $this->belongsToMany(MenuItem::class, 'menu_item_dietary_tags', 'tag_id', 'item_id');
    }
}
