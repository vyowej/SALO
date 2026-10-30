<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Restaurant extends Model
{
    protected $fillable = [
        'owner_user_id',
        'name',
        'branch_label',
        'description',
        'category',
        'legal_name',
        'contact_number',
        'business_email',
        'business_email_verified_at',
        'psgc_code',
        'street',
        'latitude',
        'longitude',
        'logo_path',
        'cover_path',
        'delivery_radius_km',
        'prep_minutes',
        'is_24_7',
        'status',
        'is_published',
    ];

    protected function casts(): array
    {
        return [
            'business_email_verified_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'delivery_radius_km' => 'decimal:2',
            'is_24_7' => 'boolean',
            'is_published' => 'boolean',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function staff(): HasMany
    {
        return $this->hasMany(RestaurantStaff::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(RestaurantApplication::class);
    }

    public function cuisines(): BelongsToMany
    {
        return $this->belongsToMany(CuisineType::class, 'restaurant_cuisines', 'restaurant_id', 'cuisine_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(RestaurantPhoto::class)->orderBy('sort_order')->orderBy('id');
    }

    public function operatingHours(): HasMany
    {
        return $this->hasMany(OperatingHour::class)->orderBy('weekday')->orderBy('shift_order');
    }

    public function closureDates(): HasMany
    {
        return $this->hasMany(ClosureDate::class)->orderBy('closure_date');
    }

    public function menuCategories(): HasMany
    {
        return $this->hasMany(MenuCategory::class)->orderBy('sort_order')->orderBy('id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function discounts(): HasMany
    {
        return $this->hasMany(Discount::class);
    }

    public function restaurantTables(): HasMany
    {
        return $this->hasMany(RestaurantTable::class);
    }

    public function reservationSetting(): HasOne
    {
        return $this->hasOne(ReservationSetting::class);
    }
}
