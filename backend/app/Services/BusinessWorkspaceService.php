<?php

namespace App\Services;

use App\Models\Restaurant;
use App\Repositories\Contracts\MenuRepository;

class BusinessWorkspaceService
{
    public function __construct(private readonly MenuRepository $menus) {}

    public function show(Restaurant $restaurant, array $membership): array
    {
        $application = $restaurant->applications()
            ->where('application_type', 'initial')
            ->where('status', 'approved')
            ->latest('id')
            ->first();
        $details = $application?->draft_details ?? [];
        $profileComplete = trim((string) $restaurant->description) !== ''
            && trim((string) ($details['category'] ?? '')) !== '';
        $hoursComplete = (bool) $restaurant->is_24_7
            || count(array_filter($details['hours'] ?? [], fn ($shifts): bool => $shifts !== [])) >= 5;

        return [
            'restaurant' => [
                'id' => (string) $restaurant->getKey(),
                'name' => $restaurant->name,
                'status' => $restaurant->status,
                'is_published' => $restaurant->is_published,
                'is_read_only' => in_array($restaurant->status, ['suspended', 'inactive'], true),
                'is_deactivated' => $restaurant->status === 'inactive',
                'role' => $membership['role'],
                'permissions' => $membership['permissions'],
            ],
            'setup_checklist' => [
                ['key' => 'profile', 'label' => 'Complete restaurant profile', 'complete' => $profileComplete, 'href' => '/business/profile'],
                ['key' => 'hours', 'label' => 'Confirm opening hours', 'complete' => $hoursComplete, 'href' => '/business/hours'],
                ['key' => 'menu', 'label' => 'Add and publish menu items', 'complete' => $this->menus->hasOrderableItem($restaurant), 'href' => '/business/menu'],
                ['key' => 'tables', 'label' => 'Set up reservation tables', 'complete' => false, 'href' => '/business/tables'],
                ['key' => 'publish', 'label' => 'Review publish checklist', 'complete' => (bool) $restaurant->is_published, 'href' => '/business/publish'],
            ],
        ];
    }
}
