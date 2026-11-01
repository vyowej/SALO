<?php

namespace App\Repositories\Database;

use App\Models\CustomerNotification;
use App\Repositories\Contracts\CustomerNotificationRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class DatabaseCustomerNotificationRepository implements CustomerNotificationRepository
{
    public function paginateForCustomer(int $userId, bool $unreadOnly, int $perPage): LengthAwarePaginator
    {
        return CustomerNotification::query()
            ->where('user_id', $userId)
            ->when($unreadOnly, fn ($query) => $query->whereNull('read_at'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(min(50, max(1, $perPage)));
    }

    public function findForCustomer(int $userId, int $notificationId): ?CustomerNotification
    {
        return CustomerNotification::query()
            ->where('user_id', $userId)
            ->whereKey($notificationId)
            ->first();
    }

    public function markRead(CustomerNotification $notification): CustomerNotification
    {
        if ($notification->read_at === null) {
            $notification->forceFill(['read_at' => now()])->save();
        }

        return $notification->refresh();
    }

    public function createForCustomer(
        int $userId,
        string $type,
        string $message,
        ?string $relatedReference,
    ): CustomerNotification {
        return CustomerNotification::query()->create([
            'user_id' => $userId,
            'type' => $type,
            'message' => $message,
            'related_reference' => $relatedReference,
            'created_at' => now(),
        ]);
    }
}
