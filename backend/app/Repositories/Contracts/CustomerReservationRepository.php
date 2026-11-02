<?php

namespace App\Repositories\Contracts;

use App\Models\Reservation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface CustomerReservationRepository
{
    public function paginateForCustomer(int $userId, array $filters): LengthAwarePaginator;

    public function findForCustomer(int $userId, int $reservationId, bool $lock = false): ?Reservation;

    public function countActiveForCustomer(int $userId): int;
}
