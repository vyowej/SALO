<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->log_id,
            'actor' => [
                'id' => (string) $this->actor_user_id,
                'name' => $this->actor?->name,
            ],
            'action' => $this->action,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'before' => $this->before_value,
            'after' => $this->after_value,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
