<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CuisineType extends Model
{
    protected $fillable = ['name', 'is_filipino'];

    protected function casts(): array
    {
        return ['is_filipino' => 'boolean'];
    }

    public function restaurants(): BelongsToMany
    {
        return $this->belongsToMany(Restaurant::class, 'restaurant_cuisines', 'cuisine_id', 'restaurant_id');
    }
}
