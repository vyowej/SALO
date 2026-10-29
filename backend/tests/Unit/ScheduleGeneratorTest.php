<?php

namespace Tests\Unit;

use App\Services\ScheduleGenerator;
use PHPUnit\Framework\TestCase;

class ScheduleGeneratorTest extends TestCase
{
    public function test_capacity_overflow_is_reported_as_unassigned(): void
    {
        $result = (new ScheduleGenerator)->generate([$this->rider('r1'), $this->rider('r2')], [$this->area('a1', 1)], [], '2026-12-01', [$this->slot()]);

        self::assertCount(1, $result['assigned']);
        self::assertCount(1, $result['unassigned']);
    }

    public function test_nearest_area_is_selected_first(): void
    {
        $rider = $this->rider('r1');
        $rider['last_position'] = ['latitude' => 6.0, 'longitude' => 122.0];
        $areas = [$this->area('b', 2, 8.0), $this->area('a', 2, 6.1)];
        $result = (new ScheduleGenerator)->generate([$rider], $areas, [], '2026-12-01', [$this->slot()]);

        self::assertSame('a', $result['assigned'][0]['service_area_id']);
    }

    public function test_existing_shift_prevents_double_booking_and_output_is_deterministic(): void
    {
        $rider = $this->rider('r1');
        $area = $this->area('a1', 2);
        $existing = [['rider' => ['id' => 'r1'], 'service_area' => ['id' => 'a1'], 'shift_date' => '2026-12-01', 'start_time' => '08:00']];
        $generator = new ScheduleGenerator;
        $first = $generator->generate([$rider], [$area], $existing, '2026-12-01', [$this->slot()]);
        $second = $generator->generate([$rider], [$area], $existing, '2026-12-01', [$this->slot()]);

        self::assertSame($first, $second);
        self::assertCount(0, $first['assigned']);
    }

    private function rider(string $id): array
    {
        return ['id' => $id, 'status' => 'active', 'last_position' => ['latitude' => 6.0, 'longitude' => 122.0]];
    }

    private function area(string $id, int $capacity, float $latitude = 6.0): array
    {
        return ['id' => $id, 'is_active' => true, 'max_riders' => $capacity, 'latitude' => $latitude, 'longitude' => 122.0, 'city_code' => 'A'];
    }

    private function slot(): array
    {
        return ['start_time' => '08:00', 'end_time' => '14:00'];
    }
}
