<?php

namespace App\Services;

use App\Models\CustomerNotification;
use App\Models\Order;
use App\Repositories\Contracts\CustomerNotificationRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CustomerNotificationService
{
    public function __construct(private readonly CustomerNotificationRepository $notifications) {}

    public function list(int $userId, bool $unreadOnly, int $perPage): LengthAwarePaginator
    {
        return $this->notifications->paginateForCustomer($userId, $unreadOnly, $perPage);
    }

    public function find(int $userId, int $notificationId): CustomerNotification
    {
        $notification = $this->notifications->findForCustomer($userId, $notificationId);
        abort_unless($notification instanceof CustomerNotification, 404);

        return $notification;
    }

    public function markRead(int $userId, int $notificationId): CustomerNotification
    {
        return $this->notifications->markRead($this->find($userId, $notificationId));
    }

    public function orderStatusChanged(Order $order, string $status): CustomerNotification
    {
        $order->loadMissing('checkoutGroup');
        $statusLabel = ucfirst(str_replace('_', ' ', $status));

        return $this->notifications->createForCustomer(
            (int) $order->checkoutGroup->user_id,
            'order_status',
            "Your order {$order->reference_code} is now {$statusLabel}.",
            $order->reference_code,
        );
    }
}
