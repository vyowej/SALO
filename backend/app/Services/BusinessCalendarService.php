<?php

namespace App\Services;

use App\Models\OperatingHour;
use App\Models\Restaurant;
use App\Repositories\Contracts\BusinessReportRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Support\Carbon;

class BusinessCalendarService
{
    public function __construct(
        private readonly BusinessReportRepository $reports,
        private readonly RestaurantPageRepository $restaurants,
    ) {}

    public function events(Restaurant $restaurant, string $start, string $end, bool $includeReservations): array
    {
        $localStart = Carbon::parse($start)->timezone('Asia/Manila');
        $localEnd = Carbon::parse($end)->timezone('Asia/Manila');
        $events = [];

        if ($restaurant->is_24_7) {
            $events[] = [
                'id' => 'hours-24-7',
                'title' => 'Open 24/7',
                'start' => $localStart->copy()->startOfDay()->toDateString(),
                'end' => $localEnd->copy()->startOfDay()->toDateString(),
                'allDay' => true,
                'extendedProps' => ['type' => 'hours'],
            ];
        } else {
            $hours = $this->restaurants->hours($restaurant);
            for ($date = $localStart->copy()->startOfDay()->subDay(); $date->lt($localEnd); $date->addDay()) {
                foreach ($hours->where('weekday', $date->dayOfWeekIso) as $shift) {
                    if (! $shift instanceof OperatingHour) {
                        continue;
                    }
                    $shiftStart = $date->copy()->setTimeFromTimeString((string) $shift->open_time);
                    $shiftEnd = $date->copy()->setTimeFromTimeString((string) $shift->close_time);
                    if ($shift->crosses_midnight) {
                        $shiftEnd->addDay();
                    }
                    if ($shiftEnd->lte($localStart) || $shiftStart->gte($localEnd)) {
                        continue;
                    }
                    $events[] = [
                        'id' => 'hours-'.$shift->getKey().'-'.$date->toDateString(),
                        'title' => 'Open · '.$shiftStart->format('g:i A').'–'.$shiftEnd->format('g:i A'),
                        'start' => $shiftStart->toIso8601String(),
                        'end' => $shiftEnd->toIso8601String(),
                        'allDay' => false,
                        'display' => 'background',
                        'extendedProps' => ['type' => 'hours'],
                    ];
                }
            }
        }

        $closures = $this->restaurants->closures(
            $restaurant,
            $localStart->toDateString(),
            $localEnd->copy()->subSecond()->toDateString(),
        );
        foreach ($closures as $closure) {
            $date = $closure->closure_date->toDateString();
            $events[] = [
                'id' => 'closure-'.$closure->getKey(),
                'title' => $closure->reason ? 'Closed · '.$closure->reason : 'Closed',
                'start' => $date,
                'allDay' => true,
                'display' => 'background',
                'extendedProps' => ['type' => 'closure'],
            ];
        }

        if ($includeReservations) {
            foreach ($this->reports->calendarReservations($restaurant, $localStart->copy()->utc(), $localEnd->copy()->utc()) as $reservation) {
                $reservationEnd = $reservation->start_at->copy()->addMinutes((int) $reservation->duration_minutes);
                if ($reservationEnd->lte($localStart->copy()->utc())) {
                    continue;
                }
                $events[] = [
                    'id' => 'reservation-'.$reservation->getKey(),
                    'title' => $reservation->reference_code ?? 'Reservation',
                    'start' => $reservation->start_at->toIso8601String(),
                    'end' => $reservationEnd->toIso8601String(),
                    'allDay' => false,
                    'extendedProps' => [
                        'type' => 'reservation',
                        'status' => $reservation->status,
                        'table_number' => $reservation->table?->table_number,
                        'guest_count' => (int) $reservation->guest_count,
                    ],
                ];
            }
        }

        return $events;
    }
}
