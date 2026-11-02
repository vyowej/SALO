<?php

namespace App\Repositories\Contracts;

use App\Models\SupportTicket;
use App\Models\TicketMessage;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface SupportTicketRepository
{
    public function paginateForCustomer(int $userId, ?string $status, int $perPage): LengthAwarePaginator;

    public function findForCustomer(int $userId, int $ticketId): ?SupportTicket;

    public function createForCustomer(int $userId, array $attributes): SupportTicket;

    public function paginateMessagesForTicket(int $ticketId, int $perPage): LengthAwarePaginator;

    public function createMessageForTicket(int $ticketId, int $userId, string $body): TicketMessage;
}
