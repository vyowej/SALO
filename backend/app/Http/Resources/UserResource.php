<?php

namespace App\Http\Resources;

use App\Http\Authorization\PermissionMap;
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
                'role' => $role,
                'status' => $membership['status'] ?? 'active',
                'permissions' => PermissionMap::forRole($role),
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
            'email_verified_at' => $this->email_verified_at?->toISOString(),
            'driver_state' => $this->driver_state,
        ];
    }
}
