<?php

namespace App\Services;

use App\Models\SupportTicket;
use App\Models\TicketMessage;
use App\Repositories\Contracts\SupportTicketRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CustomerSupportTicketService
{
    public function __construct(private readonly SupportTicketRepository $tickets) {}

    public function list(int $userId, ?string $status, int $perPage): LengthAwarePaginator
    {
        return $this->tickets->paginateForCustomer($userId, $status, $perPage);
    }

    public function create(int $userId, array $attributes): SupportTicket
    {
        return $this->tickets->createForCustomer($userId, $attributes);
    }

    public function findForCustomer(int $userId, int $ticketId): SupportTicket
    {
        $ticket = $this->tickets->findForCustomer($userId, $ticketId);
        abort_unless($ticket instanceof SupportTicket, 404);

        return $ticket;
    }

    public function listMessages(int $ticketId, int $perPage): LengthAwarePaginator
    {
        return $this->tickets->paginateMessagesForTicket($ticketId, $perPage);
    }

    public function addMessage(int $ticketId, int $userId, string $body): TicketMessage
    {
        return $this->tickets->createMessageForTicket($ticketId, $userId, $body);
    }
}
