<?php

namespace App\Repositories\Database;

use App\Models\SupportTicket;
use App\Models\TicketMessage;
use App\Repositories\Contracts\SupportTicketRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class DatabaseSupportTicketRepository implements SupportTicketRepository
{
    public function paginateForCustomer(int $userId, ?string $status, int $perPage): LengthAwarePaginator
    {
        return SupportTicket::query()
            ->where('user_id', $userId)
            ->when($status !== null && $status !== '', fn ($query) => $query->where('status', $status))
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate(min(50, max(1, $perPage)));
    }

    public function findForCustomer(int $userId, int $ticketId): ?SupportTicket
    {
        return SupportTicket::query()
            ->where('user_id', $userId)
            ->whereKey($ticketId)
            ->first();
    }

    public function createForCustomer(int $userId, array $attributes): SupportTicket
    {
        return SupportTicket::query()->create([
            'user_id' => $userId,
            'order_id' => $attributes['order_id'] ?? null,
            'assigned_admin_id' => null,
            'subject' => $attributes['subject'],
            'body' => $attributes['body'],
            'status' => 'open',
        ]);
    }

    public function paginateMessagesForTicket(int $ticketId, int $perPage): LengthAwarePaginator
    {
        return TicketMessage::query()
            ->where('ticket_id', $ticketId)
            ->orderBy('created_at')
            ->orderBy('id')
            ->paginate(min(50, max(1, $perPage)));
    }

    public function createMessageForTicket(int $ticketId, int $userId, string $body): TicketMessage
    {
        $ticket = SupportTicket::query()->findOrFail($ticketId);
        $message = TicketMessage::query()->create([
            'ticket_id' => $ticket->getKey(),
            'user_id' => $userId,
            'body' => $body,
        ]);

        $ticket->forceFill(['updated_at' => now()])->save();

        return $message;
    }
}
