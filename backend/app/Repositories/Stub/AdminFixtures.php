<?php

namespace App\Repositories\Stub;

final class AdminFixtures
{
    public static function id(int $number): string
    {
        return sprintf('00000000-0000-4000-8000-%012d', $number);
    }

    public static function records(): array
    {
        $users = [];
        for ($i = 1; $i <= 25; $i++) {
            $name = $i === 1 ? 'Admin' : "Sample User {$i}";
            $users[] = [
                'id' => self::id(100 + $i),
                'name' => $name,
                'email' => $i === 1 ? 'admin@salo.app' : "sample.user{$i}@example.test",
                'phone' => sprintf('0900000%04d', $i),
                'avatar_url' => null,
                'status' => 'active',
                'capabilities' => $i === 1 ? ['customer', 'admin'] : ($i <= 8 ? ['customer', 'driver'] : ['customer']),
                'memberships' => $i === 2 ? [[
                    'restaurant_id' => self::id(202), 'role' => 'owner', 'status' => 'active',
                    'permissions' => ['restaurant.view', 'restaurant.edit', 'menu.manage', 'orders.view', 'orders.manage', 'reservations.view', 'reservations.manage', 'tables.manage', 'discounts.manage', 'team.manage', 'analytics.view'],
                ]] : [],
                'driver_state' => $i <= 8 && $i > 1 ? ['approval_status' => 'approved', 'availability_status' => 'available'] : null,
                'email_verified_at' => '2026-10-02T09:00:00Z',
                'created_at' => '2026-10-01T08:00:00Z',
            ];
        }

        $restaurants = [];
        for ($i = 1; $i <= 8; $i++) {
            $restaurants[] = [
                'id' => self::id(200 + $i), 'name' => "Sample Restaurant {$i}", 'slug' => "sample-restaurant-{$i}",
                'description' => 'Placeholder description.', 'owner' => ['id' => self::id(102), 'name' => 'Sample User 2'],
                'phone' => '09000000001', 'email' => "restaurant{$i}@example.test",
                'logo_ref' => "photo:rest-{$i}-logo", 'cover_ref' => "photo:rest-{$i}-cover",
                'address' => ['street_line' => 'Placeholder St.', 'city_code' => '0972200000', 'city_name' => 'Zamboanga City', 'latitude' => 6.9214, 'longitude' => 122.0790],
                'categories' => ['Filipino', 'Grill'], 'status' => $i === 1 ? 'active' : ($i === 2 ? 'pending' : 'active'),
                'accepts_delivery' => true, 'accepts_pickup' => true, 'accepts_reservations' => true,
                'rating_avg' => 4.3, 'rating_count' => 18, 'created_at' => '2026-10-01T08:00:00Z',
            ];
        }

        $applications = [];
        for ($i = 1; $i <= 6; $i++) {
            $type = $i <= 3 ? 'partner' : 'rider';
            $applicant = $users[$i + 7];
            $applications[] = [
                'id' => self::id(300 + $i), 'type' => $type, 'status' => $i === 3 ? 'approved' : 'pending',
                'applicant' => ['id' => $applicant['id'], 'name' => $applicant['name'], 'email' => $applicant['email']],
                'submitted_at' => '2026-10-20T10:00:00Z', 'reviewed_by' => null, 'reviewed_at' => null, 'review_note' => null,
                'details' => $type === 'rider'
                    ? ['birth_date' => '2002-05-14', 'vehicle_type' => 'motorcycle', 'plate_no' => 'ABC 1234', 'license_no' => 'N00-00-000000', 'tin_no' => '000-000-000', 'service_area_city_code' => '0972200000', 'payout' => ['provider' => 'GCash', 'name' => 'Sample Rider', 'account_masked' => '****0000']]
                    : ['business_name' => "Sample Business {$i}", 'business_type' => 'restaurant', 'business_address' => 'Placeholder St.', 'city_code' => '0972200000', 'latitude' => 6.9214, 'longitude' => 122.0790, 'contact_phone' => '09000000001', 'cuisine_summary' => 'Filipino food', 'payout' => ['provider' => 'GCash', 'name' => 'Sample Owner', 'account_masked' => '****0000']],
                'documents' => [['id' => self::id(900 + $i), 'doc_type' => 'valid_id', 'photo_ref' => "photo:app-{$i}-valid-id", 'status' => 'submitted', 'note' => null]],
            ];
        }

        $riders = [];
        for ($i = 1; $i <= 6; $i++) {
            $riders[] = [
                'id' => self::id(102 + $i), 'name' => "Sample Rider {$i}",
                'email' => "rider{$i}@example.test", 'phone' => '09000000002',
                'status' => $i === 6 ? 'pending_activation' : 'active',
                'vehicle_type' => 'motorcycle', 'plate_no' => 'ABC 1234', 'is_online' => $i < 4,
                'last_position' => ['latitude' => 6.93 + ($i * 0.001), 'longitude' => 122.08, 'seen_at' => '2026-10-29T08:10:00Z'],
                'earnings' => ['total' => 3200.0, 'this_week' => 640.0, 'deliveries_count' => 41],
                'activated_at' => '2026-10-21T09:00:00Z', 'resigned_at' => null, 'created_at' => '2026-10-20T10:00:00Z',
            ];
        }

        $orders = [];
        $orderStatuses = ['completed', 'placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'];
        for ($i = 1; $i <= 40; $i++) {
            $status = $orderStatuses[($i - 1) % count($orderStatuses)];
            $orders[] = [
                'id' => self::id(500 + $i), 'order_number' => sprintf('SALO-%04d', $i), 'status' => $status,
                'fulfilment' => $i % 2 ? 'delivery' : 'pickup',
                'customer' => ['id' => self::id(101 + (($i - 1) % 25)), 'name' => 'Sample User'],
                'restaurant' => ['id' => self::id(201 + (($i - 1) % 8)), 'name' => 'Sample Restaurant'],
                'total' => 389.0, 'payment_method' => 'cod', 'payment_status' => 'paid',
                'placed_at' => '2026-10-29T07:50:00Z', 'subtotal' => 349.0, 'delivery_fee' => 40.0,
                'discount_total' => 0.0, 'cancelled_by' => null, 'cancel_reason' => null,
                'delivery_address_text' => 'Placeholder St., Zamboanga City',
                'rider' => ['id' => self::id(103), 'name' => 'Sample Rider 1'],
                'items' => [['item_name' => 'Sample Meal', 'quantity' => 2, 'unit_price' => 174.5, 'line_total' => 349.0, 'note' => null, 'options' => []]],
                'status_history' => [['status' => $status, 'changed_by' => null, 'note' => null, 'created_at' => '2026-10-29T07:50:00Z']],
            ];
        }

        $reservations = [];
        $reservationStatuses = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'];
        for ($i = 1; $i <= 12; $i++) {
            $status = $reservationStatuses[($i - 1) % count($reservationStatuses)];
            $reservations[] = [
                'id' => self::id(600 + $i), 'code' => sprintf('RSV-%04d', $i), 'status' => $status,
                'customer' => ['id' => self::id(101 + (($i - 1) % 25)), 'name' => 'Sample User'],
                'restaurant' => ['id' => self::id(201 + (($i - 1) % 8)), 'name' => 'Sample Restaurant'],
                'table' => ['id' => self::id(700 + $i), 'label' => "Table {$i}"],
                'party_size' => 4, 'reserved_for' => '2026-11-02T18:30:00Z', 'duration_minutes' => 90,
                'contact_name' => 'Sample User', 'contact_phone' => '09000000000', 'special_request' => null,
                'cancelled_at' => null, 'cancel_reason' => null,
            ];
        }

        $areas = [];
        foreach (['Pasonanca', 'City Proper', 'Tetuan'] as $i => $name) {
            $areas[] = ['id' => self::id(800 + $i), 'name' => $name, 'city_code' => '0972200000', 'latitude' => 6.95 + $i * 0.01, 'longitude' => 122.06, 'max_riders' => 2, 'is_active' => true];
        }
        $schedules = [];
        for ($i = 1; $i <= 15; $i++) {
            $schedules[] = ['id' => self::id(850 + $i), 'rider' => ['id' => self::id(103 + (($i - 1) % 6)), 'name' => 'Sample Rider'], 'service_area' => ['id' => self::id(800 + (($i - 1) % 3)), 'name' => $areas[($i - 1) % 3]['name']], 'shift_date' => '2026-10-30', 'start_time' => '08:00', 'end_time' => '14:00', 'status' => 'scheduled'];
        }
        $history = [];
        for ($i = 1; $i <= 20; $i++) {
            $history[] = ['id' => self::id(880 + $i), 'actor' => ['id' => self::id(101), 'name' => 'Admin'], 'restaurant' => null, 'subject_type' => 'restaurant', 'subject_id' => self::id(201), 'action' => 'status_changed', 'changes' => null, 'created_at' => '2026-10-29T08:00:00Z'];
        }

        $proofs = [];
        for ($i = 1; $i <= 6; $i++) {
            $proofs[] = ['id' => self::id(950 + $i), 'rider_id' => self::id(102 + $i), 'delivery_id' => self::id(500 + $i), 'order_number' => sprintf('SALO-%04d', $i), 'stage' => $i % 2 ? 'pickup' : 'dropoff', 'photo_ref' => "photo:proof-{$i}", 'latitude' => 6.93, 'longitude' => 122.08, 'taken_at' => '2026-10-29T08:20:00Z'];
        }

        return [
            'users' => $users, 'restaurants' => $restaurants, 'applications' => $applications, 'riders' => $riders,
            'orders' => $orders, 'reservations' => $reservations, 'service-areas' => $areas,
            'schedules' => $schedules, 'history' => $history,
            'closures' => [['id' => self::id(870), 'restaurant' => ['id' => self::id(201), 'name' => 'Sample Restaurant 1'], 'date' => '2026-11-01']],
            'settings' => [['id' => self::id(999), 'app_name' => 'SALO', 'default_delivery_fee' => 40.0, 'max_riders_per_area' => 50, 'rider_slots' => [['label' => 'Morning', 'start_time' => '08:00', 'end_time' => '14:00'], ['label' => 'Evening', 'start_time' => '14:00', 'end_time' => '22:00']]]],
            'proofs' => $proofs,
        ];
    }
}
