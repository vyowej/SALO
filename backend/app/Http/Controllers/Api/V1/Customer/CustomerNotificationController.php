<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CustomerNotificationIndexRequest;
use App\Http\Requests\Customer\CustomerNotificationReadRequest;
use App\Http\Resources\CustomerNotificationResource;
use App\Models\CustomerNotification;
use App\Services\CustomerNotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerNotificationController extends Controller
{
    public function index(
        CustomerNotificationIndexRequest $request,
        CustomerNotificationService $notifications,
    ): AnonymousResourceCollection {
        $this->authorize('viewAny', CustomerNotification::class);
        $filters = $request->validated();

        return CustomerNotificationResource::collection($notifications->list(
            (int) $request->user()->getAuthIdentifier(),
            filter_var($filters['unread_only'] ?? false, FILTER_VALIDATE_BOOLEAN),
            (int) ($filters['per_page'] ?? 15),
        ));
    }

    public function markRead(
        CustomerNotificationReadRequest $request,
        CustomerNotificationService $notifications,
        string $notification,
    ): CustomerNotificationResource {
        $notificationModel = $notifications->find(
            (int) $request->user()->getAuthIdentifier(),
            (int) $notification,
        );
        $this->authorize('update', $notificationModel);

        return CustomerNotificationResource::make($notifications->markRead(
            (int) $request->user()->getAuthIdentifier(),
            (int) $notification,
        ));
    }
}
