<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'checkout_id',
        'restaurant_id',
        'delivery_address_id',
        'reference_code',
        'order_type',
        'scheduled_for',
        'status',
        'recipient_name',
        'recipient_phone',
        'delivery_address_text',
        'delivery_country_code',
        'delivery_lat',
        'delivery_lng',
        'subtotal',
        'delivery_fee',
        'service_fee',
        'discount_amount',
        'total_amount',
        'cancelled_by_type',
        'cancelled_by_user_id',
        'cancel_reason',
        'placed_at',
        'completed_at',
        'customer_confirmed_at',
        'confirmation_method',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_for' => 'datetime',
            'delivery_lat' => 'decimal:6',
            'delivery_lng' => 'decimal:6',
            'subtotal' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'service_fee' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'placed_at' => 'datetime',
            'completed_at' => 'datetime',
            'customer_confirmed_at' => 'datetime',
        ];
    }

    public function checkoutGroup(): BelongsTo
    {
        return $this->belongsTo(CheckoutGroup::class, 'checkout_id');
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function deliveryAddress(): BelongsTo
    {
        return $this->belongsTo(UserAddress::class, 'delivery_address_id');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by_user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('changed_at')->orderBy('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->orderBy('id');
    }
}
