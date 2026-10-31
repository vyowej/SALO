<?php

namespace App\Repositories\Database;

use App\Models\AuditLog;
use App\Repositories\Contracts\AuditLogRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

class DatabaseAuditLogRepository implements AuditLogRepository
{
    public function record(array $attributes): AuditLog
    {
        return AuditLog::query()->create($attributes);
    }

    public function paginateForRestaurant(int $restaurantId, array $filters): LengthAwarePaginator
    {
        $query = AuditLog::query()
            ->with('actor')
            ->where('restaurant_id', $restaurantId);

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }
        if (! empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }
        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($nested) use ($search): void {
                $nested->where('action', 'like', '%'.$search.'%')
                    ->orWhere('entity_type', 'like', '%'.$search.'%')
                    ->orWhere('entity_id', 'like', '%'.$search.'%')
                    ->orWhereHas('actor', function ($actor) use ($search): void {
                        $actor->where('first_name', 'like', '%'.$search.'%')
                            ->orWhere('last_name', 'like', '%'.$search.'%')
                            ->orWhere('email', 'like', '%'.$search.'%');
                    });
            });
        }

        return $query->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(min(100, max(1, (int) ($filters['per_page'] ?? 15))));
    }

    public function pruneBefore(Carbon $cutoff): int
    {
        return AuditLog::query()->where('created_at', '<', $cutoff)->delete();
    }
}
