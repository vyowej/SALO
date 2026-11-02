<?php

namespace App\Policies;

use App\Models\SupportTicket;
use App\Models\User;

class SupportTicketPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === 'active' && in_array('customer', $user->capabilities, true);
    }

    public function view(User $user, SupportTicket $ticket): bool
    {
        return $this->viewAny($user) && (int) $ticket->user_id === (int) $user->getKey();
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function reply(User $user, SupportTicket $ticket): bool
    {
        return $this->view($user, $ticket) && in_array($ticket->status, ['open', 'in_review'], true);
    }
}
