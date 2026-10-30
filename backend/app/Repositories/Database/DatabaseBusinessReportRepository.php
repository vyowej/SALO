<?php

namespace App\Repositories\Database;

use App\Models\Discount;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Repositories\Contracts\BusinessReportRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class DatabaseBusinessReportRepository implements BusinessReportRepository
{
    public function orders(Restaurant $restaurant, Carbon $from, Carbon $until): Collection
    {
        return Order::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->where('placed_at', '>=', $from)
            ->where('placed_at', '<', $until)
            ->with('items')
            ->orderBy('placed_at')
            ->get();
    }

    public function orderItems(Restaurant $restaurant, Carbon $from, Carbon $until): Collection
    {
        return OrderItem::query()
            ->whereHas('order', fn (Builder $order) => $order
                ->where('restaurant_id', $restaurant->getKey())
                ->where('status', 'completed')
                ->where('placed_at', '>=', $from)
                ->where('placed_at', '<', $until))
            ->get();
    }

    public function reservations(Restaurant $restaurant, Carbon $from, Carbon $until): Collection
    {
        return Reservation::query()
            ->whereHas('table', fn (Builder $table) => $table->where('restaurant_id', $restaurant->getKey()))
            ->where('start_at', '>=', $from)
            ->where('start_at', '<', $until)
            ->with('table')
            ->get(['id', 'table_id', 'reference_code', 'start_at', 'duration_minutes', 'status', 'guest_count']);
    }

    public function calendarReservations(Restaurant $restaurant, Carbon $from, Carbon $until): Collection
    {
        return Reservation::query()
            ->whereHas('table', fn (Builder $table) => $table->where('restaurant_id', $restaurant->getKey()))
            ->where('start_at', '>=', $from->copy()->subDay())
            ->where('start_at', '<', $until)
            ->with('table')
            ->get(['id', 'table_id', 'reference_code', 'start_at', 'duration_minutes', 'status', 'guest_count']);
    }

    public function discounts(Restaurant $restaurant, Carbon $from, Carbon $until): Collection
    {
        return Discount::query()
            ->where('restaurant_id', $restaurant->getKey())
            ->with(['redemptions' => fn (Builder $redemptions) => $redemptions
                ->where('status', 'applied')
                ->where('created_at', '>=', $from)
                ->where('created_at', '<', $until)])
            ->orderBy('code')
            ->get();
    }
}
