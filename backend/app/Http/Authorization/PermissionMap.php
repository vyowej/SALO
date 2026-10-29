<?php

namespace App\Http\Authorization;

final class PermissionMap
{
    private const ROLE_PERMISSIONS = [
        'owner' => [
            'restaurant.view',
            'restaurant.edit',
            'menu.manage',
            'orders.view',
            'orders.manage',
            'reservations.view',
            'reservations.manage',
            'tables.manage',
            'discounts.manage',
            'team.manage',
            'analytics.view',
        ],
        'manager' => [
            'restaurant.view',
            'restaurant.edit',
            'menu.manage',
            'orders.view',
            'orders.manage',
            'reservations.view',
            'reservations.manage',
            'tables.manage',
            'discounts.manage',
            'analytics.view',
        ],
        'reservation_manager' => [
            'restaurant.view',
            'reservations.view',
            'reservations.manage',
            'tables.manage',
        ],
        'staff' => [
            'restaurant.view',
            'menu.manage',
            'orders.view',
            'orders.manage',
            'reservations.view',
        ],
    ];

    public static function forRole(string $role): array
    {
        return self::ROLE_PERMISSIONS[$role] ?? [];
    }
}
