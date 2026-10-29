<?php

namespace App\Http\Controllers\Api\V1\Business;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessController extends Controller
{
    public function dashboard(): JsonResponse
    {
        return response()->json([
            'data' => [
                'totals' => [
                    'orders' => 64,
                    'revenue' => 18800.5,
                    'reservations' => 12,
                    'items_sold' => 184,
                ],
                'orders_per_day' => [
                    ['date' => '2026-10-20', 'orders' => 8, 'revenue' => 540.0],
                    ['date' => '2026-10-21', 'orders' => 10, 'revenue' => 620.0],
                    ['date' => '2026-10-22', 'orders' => 9, 'revenue' => 610.0],
                ],
                'orders_by_status' => [
                    ['status' => 'pending', 'count' => 12],
                    ['status' => 'preparing', 'count' => 9],
                    ['status' => 'ready', 'count' => 6],
                    ['status' => 'completed', 'count' => 37],
                ],
                'top_items' => [
                    ['id' => 'menu_1', 'name' => 'Adobo Bowl', 'orders' => 18, 'revenue' => 2200.0],
                    ['id' => 'menu_2', 'name' => 'Sisig Rice', 'orders' => 14, 'revenue' => 1800.0],
                ],
                'pending_orders' => [
                    ['id' => 'ord_1001', 'status' => 'pending', 'total' => 540.0],
                    ['id' => 'ord_1002', 'status' => 'pending', 'total' => 420.0],
                ],
                'upcoming_reservations' => [
                    ['id' => 'res_901', 'table_label' => 'Table 04', 'guest_count' => 4, 'starts_at' => '2026-10-29T18:30:00+08:00'],
                    ['id' => 'res_902', 'table_label' => 'Table 11', 'guest_count' => 6, 'starts_at' => '2026-10-29T19:00:00+08:00'],
                ],
            ],
        ]);
    }

    public function orders(): JsonResponse
    {
        return response()->json([
            'data' => [
                ['id' => 'ord_1001', 'status' => 'pending', 'customer_name' => 'Maria Dela Cruz', 'total' => 540.0],
                ['id' => 'ord_1002', 'status' => 'accept', 'customer_name' => 'John Santos', 'total' => 420.0],
                ['id' => 'ord_1003', 'status' => 'ready', 'customer_name' => 'Ava Lim', 'total' => 280.0],
            ],
            'meta' => ['current_page' => 1, 'per_page' => 15, 'total' => 3, 'last_page' => 1],
        ]);
    }

    public function orderDetail(Request $request): JsonResponse
    {
        $id = (string) $request->route('id');

        return response()->json([
            'data' => [
                'id' => $id,
                'status' => 'pending',
                'customer_name' => 'Maria Dela Cruz',
                'service_mode' => 'pickup',
                'items' => [
                    ['name' => 'Adobo Bowl', 'quantity' => 2, 'price' => 190.0],
                    ['name' => 'Iced Tea', 'quantity' => 1, 'price' => 60.0],
                ],
                'subtotal' => 440.0,
                'fee' => 0.0,
                'total' => 440.0,
                'allowed_actions' => ['accept', 'reject', 'cancel'],
                'timeline' => [
                    ['status' => 'pending', 'at' => '2026-10-29T18:05:00+08:00'],
                ],
            ],
        ]);
    }

    public function updateOrderStatus(Request $request): JsonResponse
    {
        $status = (string) $request->input('status', 'accept');

        return response()->json([
            'data' => [
                'id' => (string) $request->route('id'),
                'status' => $status,
                'updated' => true,
                'allowed_actions' => ['prepare', 'ready', 'cancel'],
            ],
        ]);
    }

    public function menu(): JsonResponse
    {
        return response()->json([
            'data' => [
                'categories' => [
                    [
                        'id' => 'cat_1',
                        'name' => 'Mains',
                        'sort_order' => 1,
                        'items' => [
                            [
                                'id' => 'item_1',
                                'category_id' => 'cat_1',
                                'name' => 'Adobo Bowl',
                                'description' => 'Soy-braised chicken on rice.',
                                'price' => 190.0,
                                'is_active' => true,
                                'availability' => 'available',
                                'photo_ref' => 'photo:item-1',
                                'option_groups' => [
                                    ['id' => 'og_1', 'name' => 'Add-ons', 'required' => false, 'choices' => [['id' => 'oc_1', 'name' => 'Egg', 'price' => 35.0]]],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ]);
    }

    public function profile(): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => 'rest_101',
                'name' => 'SALO Kitchen',
                'description' => 'Filipino comfort food and sharing plates.',
                'logo_ref' => 'photo:rest-101-logo',
                'cover_ref' => 'photo:rest-101-cover',
                'gallery' => ['photo:rest-101-gallery-01', 'photo:rest-101-gallery-02'],
                'cuisines' => ['Filipino', 'Street food'],
                'contact' => ['phone' => '09000000001', 'email' => 'hello@salo.example'],
                'location' => ['street_line' => '88 Sample St.', 'city' => 'Quezon City', 'latitude' => 14.6091, 'longitude' => 121.0223],
                'service_modes' => ['delivery' => true, 'pickup' => true, 'reservation' => true],
                'status' => 'active',
            ],
        ]);
    }

    public function hours(): JsonResponse
    {
        return response()->json([
            'data' => [
                'days' => [
                    ['day' => 'monday', 'is_open' => true, 'open_time' => '09:00', 'close_time' => '21:00'],
                    ['day' => 'tuesday', 'is_open' => true, 'open_time' => '09:00', 'close_time' => '21:00'],
                    ['day' => 'wednesday', 'is_open' => true, 'open_time' => '09:00', 'close_time' => '21:00'],
                    ['day' => 'thursday', 'is_open' => true, 'open_time' => '09:00', 'close_time' => '21:00'],
                    ['day' => 'friday', 'is_open' => true, 'open_time' => '09:00', 'close_time' => '21:00'],
                    ['day' => 'saturday', 'is_open' => false, 'open_time' => null, 'close_time' => null],
                    ['day' => 'sunday', 'is_open' => false, 'open_time' => null, 'close_time' => null],
                ],
            ],
        ]);
    }

    public function reservations(): JsonResponse
    {
        return response()->json([
            'data' => [
                ['id' => 'res_901', 'status' => 'confirmed', 'guest_count' => 4, 'starts_at' => '2026-10-29T18:30:00+08:00', 'ends_at' => '2026-10-29T20:00:00+08:00', 'table_id' => 'tbl_4', 'customer_name' => 'Maria Dela Cruz'],
                ['id' => 'res_902', 'status' => 'pending', 'guest_count' => 2, 'starts_at' => '2026-10-29T19:15:00+08:00', 'ends_at' => '2026-10-29T20:15:00+08:00', 'table_id' => null, 'customer_name' => 'Kiko Reyes'],
            ],
            'meta' => ['current_page' => 1, 'per_page' => 15, 'total' => 2, 'last_page' => 1],
        ]);
    }

    public function tables(): JsonResponse
    {
        return response()->json([
            'data' => [
                ['id' => 'tbl_4', 'label' => 'Table 04', 'capacity' => 4, 'active' => true, 'location' => 'Main area'],
                ['id' => 'tbl_11', 'label' => 'Table 11', 'capacity' => 6, 'active' => true, 'location' => 'Patio'],
            ],
            'meta' => ['current_page' => 1, 'per_page' => 15, 'total' => 2, 'last_page' => 1],
        ]);
    }

    public function calendar(): JsonResponse
    {
        return response()->json([
            'data' => [
                ['id' => 'evt_1', 'type' => 'reservation', 'title' => 'Maria Dela Cruz', 'start' => '2026-10-29T18:30:00+08:00', 'end' => '2026-10-29T20:00:00+08:00'],
                ['id' => 'evt_2', 'type' => 'closure', 'title' => 'Kitchen maintenance', 'start' => '2026-10-30', 'end' => '2026-10-30'],
            ],
        ]);
    }

    public function staff(): JsonResponse
    {
        return response()->json([
            'data' => [
                ['id' => 'usr_201', 'name' => 'Sample Staff', 'email' => 'staff@example.test', 'position' => 'cashier', 'status' => 'active', 'added_by' => 'Sample Owner'],
                ['id' => 'usr_202', 'name' => 'Another Cook', 'email' => 'cook@example.test', 'position' => 'kitchen', 'status' => 'active', 'added_by' => 'Sample Owner'],
            ],
            'meta' => ['current_page' => 1, 'per_page' => 15, 'total' => 2, 'last_page' => 1],
        ]);
    }

    public function reports(Request $request): JsonResponse
    {
        $report = (string) $request->route('report', 'sales');

        return response()->json([
            'data' => [
                'series' => [
                    ['label' => 'Week 1', 'value' => 1200.0],
                    ['label' => 'Week 2', 'value' => 1650.0],
                    ['label' => 'Week 3', 'value' => 1480.0],
                ],
                'summary' => ['orders' => 120, 'revenue' => 12000.0],
                'report' => $report,
            ],
        ]);
    }

    public function history(): JsonResponse
    {
        return response()->json([
            'data' => [
                ['actor' => 'Sample Owner', 'subject' => 'Menu item', 'action' => 'updated', 'changes' => ['price' => 190.0], 'created_at' => '2026-10-29T18:01:00+08:00'],
                ['actor' => 'Sample Owner', 'subject' => 'Reservation', 'action' => 'confirmed', 'changes' => ['status' => 'confirmed'], 'created_at' => '2026-10-29T17:30:00+08:00'],
            ],
            'meta' => ['current_page' => 1, 'per_page' => 15, 'total' => 2, 'last_page' => 1],
        ]);
    }
}
