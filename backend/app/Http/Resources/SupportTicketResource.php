<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupportTicketResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $latestMessage = $this->messages()->latest('created_at')->first();

        return [
            'id' => (string) $this->getKey(),
            'subject' => $this->subject,
            'body' => $this->body,
            'status' => $this->status,
            'order_id' => $this->order_id ? (string) $this->order_id : null,
            'assigned_admin_id' => $this->assigned_admin_id ? (string) $this->assigned_admin_id : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'latest_message' => $latestMessage ? [
                'user_id' => (string) $latestMessage->user_id,
                'body' => $latestMessage->body,
                'created_at' => $latestMessage->created_at?->toISOString(),
            ] : null,
        ];
    }
}
