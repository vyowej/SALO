<?php

namespace App\Http\Authorization;

final class PermissionMap
{
    private const ROLE_PERMISSIONS = [
        'owner' => [
            'restaurant.view',
            'restaurant.page.edit',
            'restaurant.sensitive.edit',
            'restaurant.publish',
            'restaurant.photos.manage',
            'restaurant.hours.manage',
            'restaurant.menu.manage',
            'menu.availability.manage',
            'orders.view',
            'orders.status.update',
            'orders.cancel',
            'reservations.view',
            'reservations.manage',
            'tables.manage',
            'discounts.manage',
            'reports.sales_reservations.view',
            'reports.reservations.view',
            'team.view',
            'team.manage',
            'audit.view',
        ],
        'manager' => [
            'restaurant.view',
            'restaurant.page.edit',
            'restaurant.photos.manage',
            'restaurant.hours.manage',
            'restaurant.menu.manage',
            'menu.availability.manage',
            'orders.view',
            'orders.status.update',
            'orders.cancel',
            'reservations.view',
            'reservations.manage',
            'tables.manage',
            'discounts.manage',
            'reports.sales_reservations.view',
            'reports.reservations.view',
            'team.view',
        ],
        'reservation_manager' => [
            'restaurant.view',
            'reservations.view',
            'reservations.manage',
            'tables.manage',
            'reports.reservations.view',
        ],
        'staff' => [
            'restaurant.view',
            'menu.availability.manage',
            'orders.view',
            'orders.status.update',
        ],
    ];

    public static function forRole(string $role): array
    {
        return self::ROLE_PERMISSIONS[$role] ?? [];
    }

    public static function allows(string $role, string $permission): bool
    {
        return in_array($permission, self::forRole($role), true);
    }
}
