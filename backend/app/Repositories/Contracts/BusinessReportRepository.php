<?php

namespace App\Repositories\Contracts;

use App\Models\Restaurant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

interface BusinessReportRepository
{
    public function orders(Restaurant $restaurant, Carbon $from, Carbon $until): Collection;

    public function orderItems(Restaurant $restaurant, Carbon $from, Carbon $until): Collection;

    public function reservations(Restaurant $restaurant, Carbon $from, Carbon $until): Collection;

    public function calendarReservations(Restaurant $restaurant, Carbon $from, Carbon $until): Collection;

    public function discounts(Restaurant $restaurant, Carbon $from, Carbon $until): Collection;
}
