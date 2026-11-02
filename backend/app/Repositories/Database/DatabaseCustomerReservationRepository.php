<?php

namespace App\Repositories\Database;

use App\Models\Reservation;
use App\Repositories\Contracts\CustomerReservationRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class DatabaseCustomerReservationRepository implements CustomerReservationRepository
{
    public function paginateForCustomer(int $userId, array $filters): LengthAwarePaginator
    {
        return $this->customerReservations($userId)
            ->when(isset($filters['status']), fn (Builder $query) => $query->where('status', $filters['status']))
            ->when(isset($filters['from']), fn (Builder $query) => $query->where(
                'start_at',
                '>=',
                Carbon::parse($filters['from'], 'Asia/Manila')->startOfDay()->utc(),
            ))
            ->when(isset($filters['to']), fn (Builder $query) => $query->where(
                'start_at',
                '<',
                Carbon::parse($filters['to'], 'Asia/Manila')->addDay()->startOfDay()->utc(),
            ))
            ->orderBy('start_at')
            ->orderBy('id')
            ->paginate(min(50, max(1, (int) ($filters['per_page'] ?? 15))));
    }

    public function findForCustomer(int $userId, int $reservationId, bool $lock = false): ?Reservation
    {
        $query = $this->customerReservations($userId)->whereKey($reservationId);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function countActiveForCustomer(int $userId): int
    {
        return Reservation::query()
            ->where('user_id', $userId)
            ->where('start_at', '>=', now())
            ->where(function (Builder $query): void {
                $query->where('status', 'confirmed')
                    ->orWhere(function (Builder $pending): void {
                        $pending->where('status', 'pending')
                            ->where(function (Builder $expiry): void {
                                $expiry->whereNull('expires_at')->orWhere('expires_at', '>', now());
                            });
                    });
            })
            ->count();
    }

    private function customerReservations(int $userId): Builder
    {
        return Reservation::query()
            ->where('user_id', $userId)
            ->with(['table.restaurant.reservationSetting']);
    }
}
