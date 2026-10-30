<?php

namespace App\Services;

use App\Models\Discount;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Reservation;
use App\Models\Restaurant;
use App\Repositories\Contracts\BusinessReportRepository;
use Illuminate\Support\Carbon;

class BusinessReportService
{
    private const CANCELLED_ORDER_STATUSES = ['cancelled', 'rejected', 'delivery_failed'];

    public function __construct(private readonly BusinessReportRepository $reports) {}

    public function report(Restaurant $restaurant, string $report, array $filters): array
    {
        $fromLocal = Carbon::parse($filters['from'], 'Asia/Manila')->startOfDay();
        $untilLocal = Carbon::parse($filters['to'], 'Asia/Manila')->addDay()->startOfDay();
        $from = $fromLocal->copy()->utc();
        $until = $untilLocal->copy()->utc();

        return match ($report) {
            'sales_summary' => $this->salesSummary($restaurant, $from, $until, $fromLocal, $untilLocal),
            'orders_by_status' => $this->ordersByStatus($restaurant, $from, $until),
            'popular_items' => $this->popularItems($restaurant, $from, $until),
            'discount_usage' => $this->discountUsage($restaurant, $from, $until),
            'reservations' => $this->reservationSummary($restaurant, $from, $until),
            'no_show_rate' => $this->noShowRate($restaurant, $from, $until),
            default => abort(404),
        };
    }

    private function salesSummary(
        Restaurant $restaurant,
        Carbon $from,
        Carbon $until,
        Carbon $fromLocal,
        Carbon $untilLocal,
    ): array {
        $orders = $this->reports->orders($restaurant, $from, $until);
        $completed = $orders->where('status', 'completed');
        $sales = (float) $completed->sum(fn (Order $order): float => (float) $order->total_amount);
        $discounts = (float) $completed->sum(fn (Order $order): float => (float) $order->discount_amount);
        $days = [];
        for ($date = $fromLocal->copy(); $date->lt($untilLocal); $date->addDay()) {
            $days[$date->toDateString()] = ['date' => $date->toDateString(), 'orders' => 0, 'completed_orders' => 0, 'sales' => 0.0];
        }
        foreach ($orders as $order) {
            $date = $order->placed_at->copy()->timezone('Asia/Manila')->toDateString();
            if (! isset($days[$date])) {
                continue;
            }
            $days[$date]['orders']++;
            if ($order->status === 'completed') {
                $days[$date]['completed_orders']++;
                $days[$date]['sales'] += (float) $order->total_amount;
            }
        }
        $series = array_values(array_map(
            fn (array $day): array => [...$day, 'sales' => round($day['sales'], 2)],
            $days,
        ));

        return [
            'report' => 'sales_summary',
            'summary' => [
                'orders' => $orders->count(),
                'completed_orders' => $completed->count(),
                'cancelled_orders' => $orders->whereIn('status', self::CANCELLED_ORDER_STATUSES)->count(),
                'sales' => round($sales, 2),
                'discounts' => round($discounts, 2),
            ],
            'columns' => ['date', 'orders', 'completed_orders', 'sales'],
            'rows' => $series,
            'series' => $series,
        ];
    }

    private function ordersByStatus(Restaurant $restaurant, Carbon $from, Carbon $until): array
    {
        $orders = $this->reports->orders($restaurant, $from, $until);
        $rows = $orders->groupBy('status')
            ->map(fn ($items, string $status): array => [
                'status' => $status,
                'orders' => $items->count(),
                'order_value' => round((float) $items->sum(fn (Order $order): float => (float) $order->total_amount), 2),
            ])
            ->sortKeys()
            ->values()
            ->all();

        return [
            'report' => 'orders_by_status',
            'summary' => ['orders' => $orders->count()],
            'columns' => ['status', 'orders', 'order_value'],
            'rows' => $rows,
            'series' => $rows,
        ];
    }

    private function popularItems(Restaurant $restaurant, Carbon $from, Carbon $until): array
    {
        $items = $this->reports->orderItems($restaurant, $from, $until);
        $rows = $items->groupBy('item_name_snapshot')
            ->map(function ($soldItems, string $name): array {
                return [
                    'item' => $name,
                    'quantity' => (int) $soldItems->sum('quantity'),
                    'order_lines' => $soldItems->count(),
                    'sales' => round((float) $soldItems->sum(
                        fn (OrderItem $item): float => (float) $item->unit_price_snapshot * (int) $item->quantity,
                    ), 2),
                ];
            })
            ->sortByDesc('quantity')
            ->values()
            ->all();

        return [
            'report' => 'popular_items',
            'summary' => ['items_sold' => (int) array_sum(array_column($rows, 'quantity'))],
            'columns' => ['item', 'quantity', 'order_lines', 'sales'],
            'rows' => $rows,
            'series' => $rows,
        ];
    }

    private function discountUsage(Restaurant $restaurant, Carbon $from, Carbon $until): array
    {
        $discounts = $this->reports->discounts($restaurant, $from, $until);
        $rows = $discounts->map(function (Discount $discount): array {
            $redemptions = $discount->redemptions;

            return [
                'code' => $discount->code,
                'name' => $discount->name,
                'type' => $discount->type,
                'uses' => $redemptions->count(),
                'amount_applied' => round((float) $redemptions->sum('amount_applied'), 2),
            ];
        })->all();

        return [
            'report' => 'discount_usage',
            'summary' => [
                'uses' => (int) array_sum(array_column($rows, 'uses')),
                'amount_applied' => round((float) array_sum(array_column($rows, 'amount_applied')), 2),
            ],
            'columns' => ['code', 'name', 'type', 'uses', 'amount_applied'],
            'rows' => $rows,
            'series' => $rows,
        ];
    }

    private function reservationSummary(Restaurant $restaurant, Carbon $from, Carbon $until): array
    {
        $reservations = $this->reports->reservations($restaurant, $from, $until);
        $rows = $reservations->groupBy('status')
            ->map(fn ($items, string $status): array => ['status' => $status, 'reservations' => $items->count()])
            ->sortKeys()
            ->values()
            ->all();

        return [
            'report' => 'reservations',
            'summary' => ['reservations' => $reservations->count()],
            'columns' => ['status', 'reservations'],
            'rows' => $rows,
            'series' => $rows,
        ];
    }

    private function noShowRate(Restaurant $restaurant, Carbon $from, Carbon $until): array
    {
        $reservations = $this->reports->reservations($restaurant, $from, $until)
            ->whereIn('status', ['completed', 'no_show']);
        $completed = $reservations->where('status', 'completed')->count();
        $noShows = $reservations->where('status', 'no_show')->count();
        $eligible = $completed + $noShows;
        $rate = $eligible === 0 ? 0 : round(($noShows / $eligible) * 100, 2);
        $rows = [
            ['status' => 'completed', 'reservations' => $completed],
            ['status' => 'no_show', 'reservations' => $noShows],
        ];

        return [
            'report' => 'no_show_rate',
            'summary' => ['eligible_reservations' => $eligible, 'no_shows' => $noShows, 'no_show_rate_percent' => $rate],
            'columns' => ['status', 'reservations'],
            'rows' => $rows,
            'series' => $rows,
        ];
    }
}
