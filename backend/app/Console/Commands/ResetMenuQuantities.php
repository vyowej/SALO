<?php

namespace App\Console\Commands;

use App\Models\OperatingHour;
use App\Models\Restaurant;
use App\Repositories\Contracts\MenuRepository;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class ResetMenuQuantities extends Command
{
    protected $signature = 'salo:reset-menu-quantities';

    protected $description = 'Reset daily menu quantities at each restaurant opening time.';

    public function handle(MenuRepository $menus): int
    {
        $now = Carbon::now('Asia/Manila');
        $restaurantIds = [];
        if ($now->format('H:i') === '00:00') {
            $restaurantIds = Restaurant::query()
                ->where('is_24_7', true)
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();
        }

        $openingIds = OperatingHour::query()
            ->with('restaurant')
            ->where('weekday', $now->dayOfWeekIso)
            ->where('shift_order', 1)
            ->get()
            ->filter(fn (OperatingHour $hour): bool => $hour->restaurant !== null
                && ! $hour->restaurant->is_24_7
                && substr((string) $hour->open_time, 0, 5) === $now->format('H:i'))
            ->pluck('restaurant_id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        $count = $menus->resetDailyQuantities(array_values(array_unique([...$restaurantIds, ...$openingIds])));
        $this->info("Reset daily quantities for {$count} menu item(s).");

        return self::SUCCESS;
    }
}
