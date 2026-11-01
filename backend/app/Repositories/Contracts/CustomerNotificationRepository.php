<?php

namespace App\Repositories\Contracts;

use App\Models\CustomerNotification;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface CustomerNotificationRepository
{
    public function paginateForCustomer(int $userId, bool $unreadOnly, int $perPage): LengthAwarePaginator;

    public function findForCustomer(int $userId, int $notificationId): ?CustomerNotification;

    public function markRead(CustomerNotification $notification): CustomerNotification;

    public function createForCustomer(int $userId, string $type, string $message, ?string $relatedReference): CustomerNotification;
}
