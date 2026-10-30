<?php

namespace App\Models;

use App\Http\Authorization\PermissionMap;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = [
        'email',
        'password',
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'mobile',
        'birthday',
        'status',
        'email_verified_at',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'birthday' => 'date',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function setEmailAttribute(string $email): void
    {
        $this->attributes['email'] = mb_strtolower(trim($email));
    }

    public function getNameAttribute(): string
    {
        return trim(implode(' ', array_filter([
            $this->first_name,
            $this->middle_name,
            $this->last_name,
            $this->suffix,
        ])));
    }

    public function getPhoneAttribute(): ?string
    {
        return $this->mobile;
    }

    public function setPhoneAttribute(?string $phone): void
    {
        $this->attributes['mobile'] = $phone;
    }

    public function getAvatarUrlAttribute(): ?string
    {
        return null;
    }

    public function getDriverStateAttribute(): ?array
    {
        return null;
    }

    public function getCapabilitiesAttribute(): array
    {
        if ($this->status !== 'active') {
            return [];
        }

        $capabilities = ['customer'];
        if ($this->platformAdmin()->where('status', 'active')->exists()) {
            $capabilities[] = 'admin';
        }
        if ($this->ownedRestaurants()->exists() || $this->restaurantStaff()->where('status', 'active')->exists()) {
            $capabilities[] = 'business';
        }

        return $capabilities;
    }

    public function getMembershipsAttribute(): array
    {
        $memberships = $this->ownedRestaurants()
            ->get()
            ->map(fn (Restaurant $restaurant): array => [
                'restaurant_id' => (string) $restaurant->getKey(),
                'restaurant_name' => $restaurant->name,
                'role' => 'owner',
                'status' => 'active',
                'restaurant_status' => $restaurant->status,
                'permissions' => $this->permissionsFor('owner', $restaurant->status),
            ]);

        $staffMemberships = $this->restaurantStaff()
            ->with('restaurant')
            ->whereIn('status', ['active', 'invited', 'suspended'])
            ->get()
            ->map(fn (RestaurantStaff $staff): array => [
                'restaurant_id' => (string) $staff->restaurant_id,
                'restaurant_name' => $staff->restaurant?->name,
                'role' => $staff->staff_role,
                'status' => $staff->status,
                'restaurant_status' => $staff->restaurant?->status,
                'permissions' => $staff->status === 'active'
                    ? $this->permissionsFor($staff->staff_role, $staff->restaurant?->status)
                    : [],
            ]);

        return $memberships->concat($staffMemberships)->values()->all();
    }

    public function restaurantMembership(Restaurant $restaurant): ?array
    {
        if ((int) $restaurant->owner_user_id === (int) $this->getKey()) {
            return [
                'restaurant_id' => (string) $restaurant->getKey(),
                'restaurant_name' => $restaurant->name,
                'role' => 'owner',
                'status' => 'active',
                'restaurant_status' => $restaurant->status,
                'permissions' => $this->permissionsFor('owner', $restaurant->status),
            ];
        }

        $staff = $this->restaurantStaff()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('status', 'active')
            ->first();

        if ($staff === null) {
            return null;
        }

        return [
            'restaurant_id' => (string) $restaurant->getKey(),
            'restaurant_name' => $restaurant->name,
            'role' => $staff->staff_role,
            'status' => $staff->status,
            'restaurant_status' => $restaurant->status,
            'permissions' => $this->permissionsFor($staff->staff_role, $restaurant->status),
        ];
    }

    public function hasRestaurantMembership(Restaurant $restaurant): bool
    {
        if ((int) $restaurant->owner_user_id === (int) $this->getKey()) {
            return true;
        }

        return $this->restaurantStaff()
            ->where('restaurant_id', $restaurant->getKey())
            ->whereIn('status', ['invited', 'active', 'suspended'])
            ->exists();
    }

    private function permissionsFor(string $role, ?string $restaurantStatus): array
    {
        $permissions = PermissionMap::forRole($role);

        return $restaurantStatus === 'suspended'
            ? array_values(array_intersect($permissions, ['restaurant.view']))
            : $permissions;
    }

    public function getPreferencesAttribute(): array
    {
        $defaults = [
            'notifications' => true,
            'promotions' => true,
            'reservationReminders' => true,
            'darkMode' => false,
            'soundAlerts' => false,
        ];
        $request = app('request');

        return $request->hasSession()
            ? $request->session()->get('salo.user_preferences.'.$this->getKey(), $defaults)
            : $defaults;
    }

    public function setPreferencesAttribute(array $preferences): void
    {
        $request = app('request');
        if ($request->hasSession()) {
            $request->session()->put('salo.user_preferences.'.$this->getKey(), $preferences);
        }
    }

    public function getActiveModeAttribute(): string
    {
        $request = app('request');

        return $request->hasSession()
            ? (string) $request->session()->get('salo.active_mode', 'customer')
            : 'customer';
    }

    public function getSelectedRestaurantIdAttribute(): ?string
    {
        $request = app('request');
        $restaurantId = $request->hasSession()
            ? $request->session()->get('salo.selected_restaurant_id')
            : null;

        return $restaurantId === null ? null : (string) $restaurantId;
    }

    public function platformAdmin(): HasOne
    {
        return $this->hasOne(PlatformAdmin::class);
    }

    public function ownedRestaurants(): HasMany
    {
        return $this->hasMany(Restaurant::class, 'owner_user_id');
    }

    public function restaurantStaff(): HasMany
    {
        return $this->hasMany(RestaurantStaff::class);
    }

    public function applications(): HasMany
    {
        return $this->hasMany(RestaurantApplication::class, 'submitted_by');
    }
}
