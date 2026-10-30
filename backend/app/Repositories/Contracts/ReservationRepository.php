<?php

namespace App\Repositories\Contracts;

use App\Models\Reservation;
use App\Models\ReservationSetting;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

interface ReservationRepository
{
    public function tables(Restaurant $restaurant): Collection;

    public function lockTable(Restaurant $restaurant, int $tableId): ?RestaurantTable;

    public function lockCandidateTables(Restaurant $restaurant, int $guestCount, ?int $tableId = null): Collection;

    public function createTable(Restaurant $restaurant, array $attributes): RestaurantTable;

    public function updateTable(RestaurantTable $table, array $attributes): RestaurantTable;

    public function deleteTable(RestaurantTable $table): void;

    public function hasReservationHistory(RestaurantTable $table): bool;

    public function countAffectedReservations(RestaurantTable $table, ?int $maximumGuestCount = null): int;

    public function notifyOwnerOfMaintenance(Restaurant $restaurant, RestaurantTable $table): void;

    public function notifyReservationUser(Reservation $reservation, string $type, string $message): void;

    public function settings(Restaurant $restaurant): ?ReservationSetting;

    public function saveSettings(Restaurant $restaurant, array $attributes): ReservationSetting;

    public function paginateReservations(Restaurant $restaurant, array $filters): LengthAwarePaginator;

    public function findReservation(Restaurant $restaurant, int $reservationId, bool $lock = false): ?Reservation;

    public function overlappingReservations(
        int $tableId,
        Carbon $newStart,
        Carbon $newEnd,
        ?int $ignoreReservationId = null,
    ): Collection;

    public function createReservation(array $attributes): Reservation;

    public function updateReservation(Reservation $reservation, array $attributes): Reservation;

    public function duePendingReservations(Carbon $now): Collection;
}
