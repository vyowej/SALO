<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CustomerSupportTicketIndexRequest;
use App\Http\Requests\Customer\CustomerSupportTicketReplyRequest;
use App\Http\Requests\Customer\CustomerSupportTicketStoreRequest;
use App\Http\Resources\SupportTicketResource;
use App\Http\Resources\TicketMessageResource;
use App\Models\SupportTicket;
use App\Services\CustomerSupportTicketService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerSupportTicketController extends Controller
{
    public function index(
        CustomerSupportTicketIndexRequest $request,
        CustomerSupportTicketService $tickets,
    ): AnonymousResourceCollection {
        $this->authorize('viewAny', SupportTicket::class);
        $filters = $request->validated();

        return SupportTicketResource::collection($tickets->list(
            (int) $request->user()->getAuthIdentifier(),
            $filters['status'] ?? null,
            (int) ($filters['per_page'] ?? 15),
        ));
    }

    public function store(
        CustomerSupportTicketStoreRequest $request,
        CustomerSupportTicketService $tickets,
    ): SupportTicketResource {
        $this->authorize('create', SupportTicket::class);

        return SupportTicketResource::make($tickets->create(
            (int) $request->user()->getAuthIdentifier(),
            $request->validated(),
        ));
    }

    public function messages(
        SupportTicket $ticket,
        CustomerSupportTicketService $tickets,
    ): AnonymousResourceCollection {
        $this->authorize('view', $ticket);

        return TicketMessageResource::collection($tickets->listMessages(
            (int) $ticket->getKey(),
            25,
        ));
    }

    public function reply(
        SupportTicket $ticket,
        CustomerSupportTicketReplyRequest $request,
        CustomerSupportTicketService $tickets,
    ): TicketMessageResource {
        $this->authorize('reply', $ticket);

        return TicketMessageResource::make($tickets->addMessage(
            (int) $ticket->getKey(),
            (int) $request->user()->getAuthIdentifier(),
            $request->validated('body'),
        ));
    }
}
