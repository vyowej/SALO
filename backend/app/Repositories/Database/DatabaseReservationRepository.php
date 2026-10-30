<?php

namespace App\Repositories\Database;

use App\Models\Reservation;
use App\Models\ReservationSetting;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\BusinessNotification;
use App\Repositories\Contracts\ReservationRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class DatabaseReservationRepository implements ReservationRepository
{
    public function tables(Restaurant $restaurant): Collection
    {
        return $restaurant->restaurantTables()
            ->withCount(['reservations as attention_count' => fn (Builder $query) => $query
                ->whereIn('status', ['pending', 'confirmed'])
                ->where('start_at', '>', now())
                ->where(fn (Builder $active) => $active
                    ->where('status', 'confirmed')
                    ->orWhereNull('expires_at')
                    ->orWhere('expires_at', '>', now()))])
            ->orderBy('table_number')
            ->get();
    }

    public function lockTable(Restaurant $restaurant, int $tableId): ?RestaurantTable
    {
        return $restaurant->restaurantTables()->whereKey($tableId)->lockForUpdate()->first();
    }

    public function lockCandidateTables(Restaurant $restaurant, int $guestCount, ?int $tableId = null): Collection
    {
        return $restaurant->restaurantTables()
            ->where('status', 'active')
            ->where('capacity', '>=', $guestCount)
            ->when($tableId !== null, fn (Builder $query) => $query->whereKey($tableId))
            ->orderBy('capacity')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }

    public function createTable(Restaurant $restaurant, array $attributes): RestaurantTable
    {
        return $restaurant->restaurantTables()->create($attributes);
    }

    public function updateTable(RestaurantTable $table, array $attributes): RestaurantTable
    {
        $table->forceFill($attributes)->save();

        return $table->refresh();
    }

    public function deleteTable(RestaurantTable $table): void
    {
        $table->delete();
    }

    public function hasReservationHistory(RestaurantTable $table): bool
    {
        return $table->reservations()->exists();
    }

    public function countAffectedReservations(RestaurantTable $table, ?int $maximumGuestCount = null): int
    {
        return $table->reservations()
            ->whereIn('status', ['pending', 'confirmed'])
            ->where('start_at', '>', now())
            ->where(fn (Builder $active) => $active
                ->where('status', 'confirmed')
                ->orWhereNull('expires_at')
                ->orWhere('expires_at', '>', now()))
            ->when($maximumGuestCount !== null, fn (Builder $query) => $query->where('guest_count', '>', $maximumGuestCount))
            ->count();
    }

    public function notifyOwnerOfMaintenance(Restaurant $restaurant, RestaurantTable $table): void
    {
        BusinessNotification::query()->create([
            'user_id' => $restaurant->owner_user_id,
            'type' => 'reservation.table.maintenance',
            'message' => 'Table '.$table->table_number.' is under maintenance. Review its future reservations.',
            'related_reference' => 'restaurant:'.$restaurant->getKey().':table:'.$table->getKey(),
            'created_at' => now(),
        ]);
    }

    public function notifyReservationUser(Reservation $reservation, string $type, string $message): void
    {
        BusinessNotification::query()->create([
            'user_id' => $reservation->user_id,
            'type' => $type,
            'message' => $message,
            'related_reference' => 'reservation:'.$reservation->getKey(),
            'created_at' => now(),
        ]);
    }

    public function settings(Restaurant $restaurant): ?ReservationSetting
    {
        return $restaurant->reservationSetting()->first();
    }

    public function saveSettings(Restaurant $restaurant, array $attributes): ReservationSetting
    {
        return ReservationSetting::query()->updateOrCreate(
            ['restaurant_id' => $restaurant->getKey()],
            $attributes,
        );
    }

    public function paginateReservations(Restaurant $restaurant, array $filters): LengthAwarePaginator
    {
        return Reservation::query()
            ->with(['user', 'table'])
            ->whereHas('table', fn (Builder $table) => $table->where('restaurant_id', $restaurant->getKey()))
            ->when(isset($filters['status']), fn (Builder $query) => $query->where('status', $filters['status']))
            ->when(isset($filters['from']), fn (Builder $query) => $query->where(
                'start_at',
                '>=',
                Carbon::parse($filters['from'])->utc(),
            ))
            ->when(isset($filters['to']), fn (Builder $query) => $query->where(
                'start_at',
                '<',
                Carbon::parse($filters['to'])->utc(),
            ))
            ->when(isset($filters['table_id']), fn (Builder $query) => $query->where('table_id', $filters['table_id']))
            ->when(($filters['needs_attention'] ?? false), function (Builder $query): void {
                $query->whereIn('status', ['pending', 'confirmed'])
                    ->where('start_at', '>', now())
                    ->where(fn (Builder $active) => $active
                        ->where('status', 'confirmed')
                        ->orWhereNull('expires_at')
                        ->orWhere('expires_at', '>', now()))
                    ->whereHas('table', fn (Builder $table) => $table->where('status', '!=', 'active'));
            })
            ->orderBy('start_at')
            ->orderBy('id')
            ->paginate(min(100, max(1, (int) ($filters['per_page'] ?? 50))));
    }

    public function findReservation(Restaurant $restaurant, int $reservationId, bool $lock = false): ?Reservation
    {
        $query = Reservation::query()
            ->with(['user', 'table'])
            ->whereKey($reservationId)
            ->whereHas('table', fn (Builder $table) => $table->where('restaurant_id', $restaurant->getKey()));

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first();
    }

    public function overlappingReservations(
        int $tableId,
        Carbon $newStart,
        Carbon $newEnd,
        ?int $ignoreReservationId = null,
    ): Collection {
        return Reservation::query()
            ->where('table_id', $tableId)
            ->where('start_at', '<', $newEnd)
            ->whereIn('status', ['pending', 'confirmed'])
            ->where(function (Builder $query): void {
                $query->where('status', 'confirmed')
                    ->orWhere(function (Builder $pending): void {
                        $pending->where('status', 'pending')
                            ->where(function (Builder $expiry): void {
                                $expiry->whereNull('expires_at')->orWhere('expires_at', '>', now());
                            });
                    });
            })
            ->when($ignoreReservationId !== null, fn (Builder $query) => $query->where('id', '!=', $ignoreReservationId))
            ->get(['id', 'start_at', 'duration_minutes', 'status', 'expires_at']);
    }

    public function createReservation(array $attributes): Reservation
    {
        return Reservation::query()->create($attributes)->load(['user', 'table']);
    }

    public function updateReservation(Reservation $reservation, array $attributes): Reservation
    {
        $reservation->forceFill($attributes)->save();

        return $reservation->refresh()->load(['user', 'table']);
    }

    public function duePendingReservations(Carbon $now): Collection
    {
        return Reservation::query()
            ->with('table')
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $now)
            ->orderBy('expires_at')
            ->get(['id', 'table_id']);
    }
}
