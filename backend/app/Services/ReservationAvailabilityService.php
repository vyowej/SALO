<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\ReservationSetting;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Repositories\Contracts\ReservationRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReservationAvailabilityService
{
    public function __construct(
        private readonly ReservationRepository $reservations,
        private readonly RestaurantPageRepository $restaurants,
    ) {}

    public function createReservation(Restaurant $restaurant, User $customer, array $data): Reservation
    {
        return DB::transaction(function () use ($restaurant, $customer, $data): Reservation {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $settings = $this->reservations->settings($lockedRestaurant);
            $this->assertBookingAllowed($lockedRestaurant, $settings, $data);
            $startAt = Carbon::parse($data['start_at'])->utc();
            $duration = (int) ($data['duration_minutes'] ?? $settings->dining_minutes);
            $table = $this->lockAvailableTable(
                $lockedRestaurant,
                $settings,
                $startAt,
                $duration,
                (int) $data['guest_count'],
                isset($data['table_id']) ? (int) $data['table_id'] : null,
            );
            $status = $settings->confirm_mode === 'automatic' ? 'confirmed' : 'pending';

            return $this->reservations->createReservation([
                'user_id' => $customer->getKey(),
                'table_id' => $table->getKey(),
                'reference_code' => 'SALO-RSV-'.Str::upper(Str::random(10)),
                'start_at' => $startAt,
                'duration_minutes' => $duration,
                'guest_count' => (int) $data['guest_count'],
                'reserved_for_name' => trim($data['reserved_for_name']),
                'contact_phone' => trim($data['contact_phone']),
                'special_request' => isset($data['special_request']) ? trim($data['special_request']) : null,
                'status' => $status,
                'expires_at' => $status === 'pending'
                    ? now()->addHours((int) $settings->review_window_hours)
                    : null,
            ]);
        });
    }

    public function lockAvailableTable(
        Restaurant $restaurant,
        ?ReservationSetting $settings,
        Carbon $startAt,
        int $durationMinutes,
        int $guestCount,
        ?int $tableId = null,
        ?int $ignoreReservationId = null,
    ): RestaurantTable {
        $this->assertBookingAllowed($restaurant, $settings, [
            'start_at' => $startAt,
            'duration_minutes' => $durationMinutes,
            'guest_count' => $guestCount,
        ]);
        $endAt = $startAt->copy()->addMinutes($durationMinutes);
        $this->assertWithinRestaurantHours($restaurant, $settings, $startAt, $endAt);

        foreach ($this->reservations->lockCandidateTables($restaurant, $guestCount, $tableId) as $table) {
            if ($this->hasOverlap($table, $startAt, $endAt, $ignoreReservationId)) {
                continue;
            }

            return $table;
        }

        throw ValidationException::withMessages([
            'start_at' => ['No suitable table is available for that time. Choose another time or party size.'],
        ]);
    }

    private function assertBookingAllowed(Restaurant $restaurant, ?ReservationSetting $settings, array $data): void
    {
        if (
            $settings === null
            || ! $settings->accepts_reservations
            || $settings->review_window_hours === null
            || $settings->slot_minutes === null
            || $settings->dining_minutes === null
            || $settings->min_lead_hours === null
            || $settings->max_months_ahead === null
            || $settings->max_party_size === null
            || $settings->grace_minutes === null
            || $settings->cancel_cutoff_hours === null
        ) {
            throw ValidationException::withMessages([
                'settings' => ['This restaurant is not accepting reservations.'],
            ]);
        }
        if ($restaurant->status !== 'approved' || ! $restaurant->is_published) {
            throw ValidationException::withMessages([
                'restaurant' => ['This restaurant is not accepting reservations right now.'],
            ]);
        }

        $startAt = $data['start_at'] instanceof Carbon
            ? $data['start_at']->copy()
            : Carbon::parse($data['start_at'])->utc();
        $duration = (int) ($data['duration_minutes'] ?? $settings->dining_minutes);
        $guests = (int) $data['guest_count'];
        $now = now('UTC');
        if ($startAt->lt($now->copy()->addHours((int) $settings->min_lead_hours))) {
            throw ValidationException::withMessages([
                'start_at' => ['Choose a reservation time that meets the restaurant minimum lead time.'],
            ]);
        }
        if ($startAt->gt($now->copy()->addMonths((int) $settings->max_months_ahead))) {
            throw ValidationException::withMessages([
                'start_at' => ['Reservations are not available that far in advance.'],
            ]);
        }
        if ($guests < 1 || $guests > (int) $settings->max_party_size) {
            throw ValidationException::withMessages([
                'guest_count' => ['The party size is outside this restaurant’s reservation limits.'],
            ]);
        }
        if ($duration < 1 || $duration > 1440) {
            throw ValidationException::withMessages([
                'duration_minutes' => ['Reservation duration must be between 1 minute and 24 hours.'],
            ]);
        }
    }

    private function assertWithinRestaurantHours(
        Restaurant $restaurant,
        ReservationSetting $settings,
        Carbon $startAt,
        Carbon $endAt,
    ): void {
        $localStart = $startAt->copy()->timezone('Asia/Manila');
        $localEnd = $endAt->copy()->timezone('Asia/Manila');
        $closures = $this->restaurants->closures(
            $restaurant,
            $localStart->toDateString(),
            $localEnd->copy()->subSecond()->toDateString(),
        );
        if ($closures->isNotEmpty()) {
            throw ValidationException::withMessages([
                'start_at' => ['The restaurant is closed on that date.'],
            ]);
        }

        $hours = $this->restaurants->hours($restaurant);
        if ($restaurant->is_24_7) {
            if (! $this->matchesSlotInterval($settings, $localStart, $localStart->copy()->startOfDay())) {
                throw ValidationException::withMessages([
                    'start_at' => ['Choose a time that follows the restaurant’s reservation slot interval.'],
                ]);
            }

            return;
        }

        $date = $localStart->copy()->startOfDay()->subDay();
        $lastDate = $localEnd->copy()->startOfDay();
        while ($date->lte($lastDate)) {
            $weekday = $date->dayOfWeekIso;
            foreach ($hours->where('weekday', $weekday) as $shift) {
                $shiftStart = $date->copy()->setTimeFromTimeString((string) $shift->open_time);
                $shiftEnd = $date->copy()->setTimeFromTimeString((string) $shift->close_time);
                if ($shift->crosses_midnight) {
                    $shiftEnd->addDay();
                }
                if (
                    $localStart->gte($shiftStart)
                    && $localEnd->lte($shiftEnd)
                    && $this->matchesSlotInterval($settings, $localStart, $shiftStart)
                ) {
                    return;
                }
            }
            $date->addDay();
        }

        throw ValidationException::withMessages([
            'start_at' => ['The reservation must fit within the restaurant’s operating hours.'],
        ]);
    }

    private function matchesSlotInterval(ReservationSetting $settings, Carbon $startAt, Carbon $anchor): bool
    {
        $minutes = (int) (($startAt->getTimestamp() - $anchor->getTimestamp()) / 60);

        return $minutes >= 0
            && $startAt->format('s.u') === '00.000000'
            && $minutes % (int) $settings->slot_minutes === 0;
    }

    private function hasOverlap(
        RestaurantTable $table,
        Carbon $newStart,
        Carbon $newEnd,
        ?int $ignoreReservationId,
    ): bool {
        foreach ($this->reservations->overlappingReservations(
            (int) $table->getKey(),
            $newStart,
            $newEnd,
            $ignoreReservationId,
        ) as $reservation) {
            $existingStart = $reservation->start_at;
            $existingEnd = $existingStart->copy()->addMinutes((int) $reservation->duration_minutes);
            if ($existingStart->lt($newEnd) && $existingEnd->gt($newStart)) {
                return true;
            }
        }

        return false;
    }
}
