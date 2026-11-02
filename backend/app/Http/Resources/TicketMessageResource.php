<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TicketMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->getKey(),
            'ticket_id' => (string) $this->ticket_id,
            'user_id' => (string) $this->user_id,
            'body' => $this->body,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
