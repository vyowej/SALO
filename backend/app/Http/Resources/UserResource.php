<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $memberships = collect($this->memberships ?? [])->map(function (array $membership): array {
            $role = (string) ($membership['role'] ?? '');

            return [
                'restaurant_id' => $membership['restaurant_id'],
                'restaurant_name' => $membership['restaurant_name'] ?? null,
                'role' => $role,
                'status' => $membership['status'],
                'restaurant_status' => $membership['restaurant_status'] ?? null,
                'permissions' => $membership['status'] === 'active'
                    ? PermissionMap::forRole($role)
                    : [],
            ];
        })->values();

        return [
            'id' => (string) $this->getAuthIdentifier(),
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar_url' => $this->avatar_url,
            'status' => $this->status,
            'capabilities' => $this->capabilities ?? ['customer'],
            'memberships' => $memberships,
            'active_mode' => $this->active_mode,
            'selected_restaurant_id' => $this->selected_restaurant_id,
            'email_verified_at' => $this->email_verified_at?->toISOString(),
            'driver_state' => $this->driver_state,
        ];
    }
}
