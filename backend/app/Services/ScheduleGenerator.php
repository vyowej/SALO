<?php

namespace App\Services;

final class ScheduleGenerator
{
    public function generate(array $riders, array $areas, array $existing, string $date, array $slots): array
    {
        $assigned = [];
        $unassigned = [];
        $usage = [];
        foreach ($slots as $slot) {
            $counts = [];
            foreach ($areas as $area) {
                $counts[$area['id']] = count(array_filter($existing, fn ($shift) => $shift['service_area']['id'] === $area['id'] && $shift['shift_date'] === $date && $shift['start_time'] === $slot['start_time']));
            }
            $booked = [];
            foreach ($riders as $rider) {
                if ($rider['status'] !== 'active') {
                    continue;
                }
                $alreadyBooked = array_filter($existing, fn ($shift) => $shift['rider']['id'] === $rider['id'] && $shift['shift_date'] === $date && $shift['start_time'] === $slot['start_time']);
                if ($alreadyBooked || isset($booked[$rider['id']])) {
                    continue;
                }
                $booked[$rider['id']] = true;
                $candidates = array_values(array_filter($areas, fn ($area) => $area['is_active'] && $counts[$area['id']] < $area['max_riders']));
                usort($candidates, function ($a, $b) use ($rider): int {
                    $position = $rider['last_position'] ?? null;
                    if ($position === null) {
                        $aMatch = $a['city_code'] === ($rider['service_area_city_code'] ?? null);
                        $bMatch = $b['city_code'] === ($rider['service_area_city_code'] ?? null);

                        return ($bMatch <=> $aMatch) ?: strcmp($a['id'], $b['id']);
                    }

                    return ($this->distance($position, $a) <=> $this->distance($position, $b)) ?: strcmp($a['id'], $b['id']);
                });
                if ($candidates === []) {
                    $unassigned[] = ['rider_id' => $rider['id'], 'reason' => 'All service areas are full for this slot'];

                    continue;
                }
                $area = $candidates[0];
                $counts[$area['id']]++;
                $assigned[] = ['rider_id' => $rider['id'], 'service_area_id' => $area['id'], 'start_time' => $slot['start_time'], 'end_time' => $slot['end_time']];
            }
            foreach ($areas as $area) {
                $usage[] = ['service_area_id' => $area['id'], 'start_time' => $slot['start_time'], 'assigned' => $counts[$area['id']], 'max' => $area['max_riders']];
            }
        }

        return ['date' => $date, 'assigned' => $assigned, 'unassigned' => $unassigned, 'area_usage' => $usage];
    }

    private function distance(array $point, array $area): float
    {
        $r = 6371;
        $lat1 = deg2rad((float) $point['latitude']);
        $lat2 = deg2rad((float) $area['latitude']);
        $deltaLat = $lat2 - $lat1;
        $deltaLon = deg2rad((float) $area['longitude'] - (float) $point['longitude']);
        $a = sin($deltaLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($deltaLon / 2) ** 2;

        return 2 * $r * asin(sqrt($a));
    }
}
