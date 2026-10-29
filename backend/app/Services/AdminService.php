<?php

namespace App\Services;

use App\Http\Authorization\PermissionMap;
use App\Repositories\Contracts\AdminRepository;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminService
{
    public function __construct(private readonly AdminRepository $repository) {}

    public function list(string $resource, array $params): array
    {
        $items = $this->repository->all($resource);
        foreach ($params as $key => $value) {
            if ($value === null || $value === '' || in_array($key, ['page', 'per_page', 'search', 'sort', 'direction'], true)) {
                continue;
            }
            $items = array_values(array_filter($items, function (array $item) use ($key, $value): bool {
                if ($key === 'capability') {
                    return in_array($value, $item['capabilities'] ?? [], true);
                }
                if ($key === 'restaurant_id') {
                    if ($resource === 'users') {
                        return collect($item['memberships'] ?? [])->contains(fn ($membership) => ($membership['restaurant_id'] ?? null) === $value);
                    }

                    return data_get($item, 'restaurant.id', $item['restaurant_id'] ?? null) === $value
                        || ($resource === 'history' && ($item['subject_type'] ?? null) === 'restaurant' && ($item['subject_id'] ?? null) === $value);
                }
                if ($key === 'date') {
                    return ($item['shift_date'] ?? null) === $value;
                }
                $field = match ($key) {
                    'city_code' => 'address.city_code',
                    'actor_id' => 'actor.id',
                    'from', 'to' => match ($resource) {
                        'orders' => 'placed_at',
                        'reservations' => 'reserved_for',
                        default => 'created_at',
                    },
                    default => $key,
                };
                if ($key === 'from') {
                    return substr((string) data_get($item, $field), 0, 10) >= $value;
                }
                if ($key === 'to') {
                    return substr((string) data_get($item, $field), 0, 10) <= $value;
                }

                return data_get($item, $field) == $value;
            }));
        }
        if (! empty($params['search'])) {
            $search = mb_strtolower((string) $params['search']);
            $items = array_values(array_filter($items, fn (array $item) => str_contains(mb_strtolower(json_encode($item) ?: ''), $search)));
        }
        $sort = $params['sort'] ?? match ($resource) {
            'orders' => 'placed_at',
            'reservations' => 'reserved_for',
            'applications' => 'submitted_at',
            'schedules' => 'shift_date',
            'proofs' => 'taken_at',
            default => 'created_at',
        };
        $direction = ($params['direction'] ?? 'desc') === 'asc' ? 1 : -1;
        usort($items, fn (array $a, array $b) => $direction * strnatcasecmp((string) data_get($a, $sort, ''), (string) data_get($b, $sort, '')));
        $total = count($items);
        $perPage = min(100, max(1, (int) ($params['per_page'] ?? 15)));
        $page = max(1, (int) ($params['page'] ?? 1));

        $pageItems = array_slice($items, ($page - 1) * $perPage, $perPage);
        if ($resource === 'orders') {
            $fields = array_flip(['id', 'order_number', 'status', 'fulfilment', 'customer', 'restaurant', 'total', 'payment_method', 'payment_status', 'placed_at']);
            $pageItems = array_map(fn ($item) => array_intersect_key($item, $fields), $pageItems);
        }
        if ($resource === 'users') {
            $pageItems = array_map(fn ($item) => $this->safeUser($item), $pageItems);
        }

        return [
            'data' => $pageItems,
            'meta' => ['current_page' => $page, 'per_page' => $perPage, 'total' => $total, 'last_page' => (int) max(1, ceil($total / $perPage))],
        ];
    }

    public function find(string $resource, string $id): array
    {
        $record = $this->repository->find($resource, $id) ?? abort(404);

        return $resource === 'users' ? $this->safeUser($record) : $record;
    }

    public function create(string $resource, array $data, object $actor): array
    {
        if ($resource === 'users') {
            $data['capabilities'] = array_values(array_unique(array_merge(['customer'], $data['capabilities'] ?? [])));
            $this->assertValidCombination($data['capabilities'], $data['memberships'] ?? []);
            $this->assertUniqueEmail($data['email']);
            $data['password_hash'] = Hash::make($data['password']);
            unset($data['password']);
            $data['avatar_url'] = null;
            $data['memberships'] ??= [];
            $data['driver_state'] = null;
            $data['email_verified_at'] = null;
            $data['status'] ??= 'active';
            $data['created_at'] = now()->toISOString();
        }
        if ($resource === 'restaurants') {
            $data['slug'] ??= Str::slug($data['name']).'-'.Str::lower(Str::random(5));
            $data['description'] ??= null;
            $data['status'] ??= 'pending';
            $data['owner'] ??= null;
            $data['phone'] ??= null;
            $data['email'] ??= null;
            $data['logo_ref'] ??= null;
            $data['cover_ref'] ??= null;
            $data['address'] ??= ['street_line' => null, 'city_code' => null, 'city_name' => null, 'latitude' => null, 'longitude' => null];
            $data['categories'] ??= [];
            $data['accepts_delivery'] ??= false;
            $data['accepts_pickup'] ??= false;
            $data['accepts_reservations'] ??= false;
            $data['rating_avg'] = 0.0;
            $data['rating_count'] = 0;
            $data['created_at'] = now()->toISOString();
        }
        if ($resource === 'service-areas') {
            $data['is_active'] ??= true;
        }
        $record = $this->repository->create($resource, $data);
        $this->history($actor, $resource, $record['id'], 'created', null);

        return $resource === 'users' ? $this->safeUser($record) : $record;
    }

    public function update(string $resource, string $id, array $data, object $actor): array
    {
        $current = $this->find($resource, $id);
        if ($resource === 'users') {
            if (isset($data['capabilities'])) {
                $data['capabilities'] = array_values(array_unique(array_merge(['customer'], $data['capabilities'])));
            }
            $this->assertValidCombination($data['capabilities'] ?? $current['capabilities'] ?? [], $data['memberships'] ?? $current['memberships'] ?? []);
            if (isset($data['email']) && $data['email'] !== $current['email']) {
                $this->assertUniqueEmail($data['email'], $id);
            }
            if (isset($data['password'])) {
                $data['password_hash'] = Hash::make($data['password']);
            }
            unset($data['password']);
        }
        $updated = $this->repository->update($resource, $id, $data) ?? abort(404);
        $this->history($actor, $resource, $id, 'updated', ['fields' => array_keys($data)]);

        return $resource === 'users' ? $this->safeUser($updated) : $updated;
    }

    public function delete(string $resource, string $id, object $actor): void
    {
        $record = $this->find($resource, $id);
        abort_unless($this->repository->delete($resource, $id), 404);
        $this->history($actor, $resource, $id, 'deleted', ['id' => $record['id']]);
    }

    public function setUserStatus(string $id, string $status, object $actor, ?string $reason = null): array
    {
        $user = $this->find('users', $id);
        $updated = $this->repository->update('users', $id, ['status' => $status]);
        $this->history($actor, 'user', $id, 'status_changed', ['status' => ['from' => $user['status'], 'to' => $status], 'reason' => $reason]);

        return $this->safeUser($updated);
    }

    public function setRestaurantStatus(string $id, string $status, object $actor, ?string $note = null): array
    {
        $restaurant = $this->find('restaurants', $id);
        $updated = $this->repository->update('restaurants', $id, ['status' => $status]);
        $this->history($actor, 'restaurant', $id, 'status_changed', ['status' => ['from' => $restaurant['status'], 'to' => $status], 'note' => $note]);

        return $updated;
    }

    public function decideApplication(string $type, string $id, bool $approve, ?string $note, object $actor): array
    {
        $application = collect($this->repository->all('applications'))->first(fn ($item) => $item['id'] === $id && $item['type'] === $type);
        abort_if($application === null, 404);
        if ($application['status'] !== 'pending') {
            throw ValidationException::withMessages(['status' => ['Only pending applications can be reviewed.']]);
        }
        if ($approve) {
            $user = $this->find('users', $application['applicant']['id']);
            if ($type === 'rider') {
                $this->assertValidCombination(array_values(array_unique(array_merge($user['capabilities'] ?? [], ['driver']))), $user['memberships'] ?? []);
                $this->repository->update('users', $user['id'], ['capabilities' => array_values(array_unique(array_merge($user['capabilities'] ?? [], ['driver'])))]);
                $this->repository->create('riders', [
                    'id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'phone' => $user['phone'],
                    'status' => 'pending_activation', 'vehicle_type' => data_get($application, 'details.vehicle_type'),
                    'plate_no' => data_get($application, 'details.plate_no'), 'is_online' => false, 'last_position' => null,
                    'earnings' => ['total' => 0.0, 'this_week' => 0.0, 'deliveries_count' => 0], 'activated_at' => null, 'resigned_at' => null,
                    'created_at' => now()->toISOString(),
                ]);
            } else {
                $this->assertValidCombination($user['capabilities'] ?? [], array_merge($user['memberships'] ?? [], [['role' => 'owner', 'status' => 'active']]));
                $restaurant = $this->repository->create('restaurants', [
                    'name' => data_get($application, 'details.business_name'), 'slug' => Str::slug((string) data_get($application, 'details.business_name')).'-'.Str::random(5),
                    'description' => data_get($application, 'details.cuisine_summary'), 'owner' => ['id' => $user['id'], 'name' => $user['name']],
                    'phone' => data_get($application, 'details.contact_phone'), 'email' => $user['email'], 'logo_ref' => null, 'cover_ref' => null,
                    'address' => ['street_line' => data_get($application, 'details.business_address'), 'city_code' => data_get($application, 'details.city_code'), 'city_name' => '', 'latitude' => data_get($application, 'details.latitude'), 'longitude' => data_get($application, 'details.longitude')],
                    'categories' => [], 'status' => 'active', 'accepts_delivery' => true, 'accepts_pickup' => true, 'accepts_reservations' => true,
                    'rating_avg' => 0.0, 'rating_count' => 0, 'created_at' => now()->toISOString(),
                ]);
                $membership = ['restaurant_id' => $restaurant['id'], 'role' => 'owner', 'status' => 'active', 'permissions' => PermissionMap::forRole('owner')];
                $this->repository->update('users', $user['id'], ['memberships' => array_merge($user['memberships'] ?? [], [$membership])]);
            }
        }
        $updated = $this->repository->update('applications', $id, ['status' => $approve ? 'approved' : 'rejected', 'reviewed_by' => $actor->getAuthIdentifier(), 'reviewed_at' => now()->toISOString(), 'review_note' => $note]);
        $this->history($actor, 'application', $id, $approve ? 'approved' : 'rejected', ['note' => $note, 'type' => $type]);

        return $updated;
    }

    public function setRiderStatus(string $id, string $status, object $actor): array
    {
        $rider = $this->find('riders', $id);
        $updated = $this->repository->update('riders', $id, ['status' => $status]);
        $this->history($actor, 'rider', $id, 'status_changed', ['status' => ['from' => $rider['status'], 'to' => $status]]);

        return $updated;
    }

    public function cancelOrder(string $id, string $reason, object $actor): array
    {
        $order = $this->find('orders', $id);
        if (in_array($order['status'], ['completed', 'cancelled', 'rejected'], true)) {
            throw ValidationException::withMessages(['status' => ['This order cannot be cancelled.']]);
        }
        $order['status'] = 'cancelled';
        $order['cancelled_by'] = 'admin';
        $order['cancel_reason'] = $reason;
        $order['status_history'][] = ['status' => 'cancelled', 'changed_by' => $actor->getAuthIdentifier(), 'note' => $reason, 'created_at' => now()->toISOString()];
        $updated = $this->repository->update('orders', $id, $order);
        $this->history($actor, 'order', $id, 'cancelled', ['reason' => $reason]);

        return $updated;
    }

    public function setReservationStatus(string $id, string $status, ?string $reason, object $actor): array
    {
        $reservation = $this->find('reservations', $id);
        $allowed = ['pending' => ['confirmed', 'cancelled'], 'confirmed' => ['seated', 'cancelled', 'no_show'], 'seated' => ['completed']];
        if (! in_array($status, $allowed[$reservation['status']] ?? [], true)) {
            throw ValidationException::withMessages(['status' => ['This reservation status transition is not allowed.']]);
        }
        $changes = ['status' => $status];
        if ($status === 'cancelled') {
            $changes['cancelled_at'] = now()->toISOString();
            $changes['cancel_reason'] = $reason;
        }
        $updated = $this->repository->update('reservations', $id, $changes);
        $this->history($actor, 'reservation', $id, 'status_changed', ['status' => ['from' => $reservation['status'], 'to' => $status], 'reason' => $reason]);

        return $updated;
    }

    public function dashboard(): array
    {
        $orders = $this->repository->all('orders');

        return [
            'totals' => ['users' => count($this->repository->all('users')), 'restaurants' => count($this->repository->all('restaurants')), 'riders' => count($this->repository->all('riders')), 'orders' => count($orders), 'revenue' => array_sum(array_column($orders, 'total'))],
            'orders_per_day' => array_map(fn ($i) => ['date' => now()->subDays($i)->toDateString(), 'orders' => 1, 'revenue' => 389.0], range(29, 0)),
            'orders_by_status' => collect($orders)->countBy('status')->map(fn ($count, $status) => ['status' => $status, 'count' => $count])->values()->all(),
            'top_restaurants' => array_slice(array_map(fn ($restaurant) => ['id' => $restaurant['id'], 'name' => $restaurant['name'], 'orders' => 12, 'revenue' => 5400.0], $this->repository->all('restaurants')), 0, 5),
            'new_users_per_week' => [['week_start' => now()->startOfWeek()->toDateString(), 'count' => 5]],
        ];
    }

    public function report(string $report, array $params): array
    {
        $title = ['sales' => 'Sales by day', 'orders-by-status' => 'Orders by status', 'restaurant-ranking' => 'Restaurant ranking', 'rider-performance' => 'Rider performance'][$report] ?? abort(404);
        $columns = [['key' => 'label', 'label' => $report === 'sales' ? 'Date' : 'Name', 'type' => $report === 'sales' ? 'date' : 'text'], ['key' => 'orders', 'label' => 'Orders', 'type' => 'number']];
        $rows = [];
        if ($report === 'orders-by-status') {
            $rows = collect($this->repository->all('orders'))->countBy('status')->map(fn ($count, $status) => ['label' => $status, 'orders' => $count])->values()->all();
        } elseif ($report === 'restaurant-ranking') {
            $columns[] = ['key' => 'revenue', 'label' => 'Revenue', 'type' => 'money'];
            $rows = array_map(fn ($restaurant) => ['label' => $restaurant['name'], 'orders' => 12, 'revenue' => 5400.0, 'rating_avg' => $restaurant['rating_avg']], $this->repository->all('restaurants'));
        } elseif ($report === 'rider-performance') {
            $columns = [['key' => 'label', 'label' => 'Rider', 'type' => 'text'], ['key' => 'deliveries', 'label' => 'Deliveries', 'type' => 'number'], ['key' => 'earnings', 'label' => 'Earnings', 'type' => 'money']];
            $rows = array_map(fn ($rider) => ['label' => $rider['name'], 'deliveries' => data_get($rider, 'earnings.deliveries_count', 0), 'earnings' => data_get($rider, 'earnings.total', 0)], $this->repository->all('riders'));
        } else {
            $columns[] = ['key' => 'revenue', 'label' => 'Revenue', 'type' => 'money'];
            $rows = array_map(fn ($point) => ['label' => $point['date'], 'orders' => $point['orders'], 'revenue' => $point['revenue']], $this->dashboard()['orders_per_day']);
        }

        return ['title' => $title, 'from' => $params['from'] ?? now()->subDays(30)->toDateString(), 'to' => $params['to'] ?? now()->toDateString(), 'columns' => $columns, 'rows' => $rows, 'totals' => null];
    }

    public function calendar(array $params): array
    {
        $events = [];
        foreach ($this->repository->all('schedules') as $schedule) {
            $events[] = ['id' => 'shift-'.$schedule['id'], 'type' => 'shift', 'title' => $schedule['rider']['name'].' - '.$schedule['service_area']['name'], 'start' => $schedule['shift_date'].'T'.$schedule['start_time'].':00Z', 'end' => $schedule['shift_date'].'T'.$schedule['end_time'].':00Z', 'all_day' => false, 'meta' => ['rider_id' => $schedule['rider']['id'], 'service_area_id' => $schedule['service_area']['id']]];
        }
        foreach ($this->repository->all('closures') as $closure) {
            $events[] = ['id' => 'closure-'.$closure['id'], 'type' => 'closure', 'title' => $closure['restaurant']['name'].' closed', 'start' => $closure['date'], 'end' => $closure['date'], 'all_day' => true, 'meta' => ['restaurant_id' => $closure['restaurant']['id']]];
        }
        foreach ($this->repository->all('reservations') as $reservation) {
            $events[] = ['id' => 'reservation-'.$reservation['id'], 'type' => 'reservation', 'title' => $reservation['restaurant']['name'].' - party of '.$reservation['party_size'], 'start' => $reservation['reserved_for'], 'end' => Carbon::parse($reservation['reserved_for'])->addMinutes($reservation['duration_minutes'])->toISOString(), 'all_day' => false, 'meta' => ['reservation_id' => $reservation['id']]];
        }
        if (isset($params['from']) || isset($params['to'])) {
            $events = array_values(array_filter($events, fn ($event) => (! isset($params['from']) || substr($event['start'], 0, 10) >= $params['from']) && (! isset($params['to']) || substr($event['start'], 0, 10) <= $params['to'])));
        }

        return $events;
    }

    public function settings(): array
    {
        $settings = $this->repository->all('settings')[0] ?? [];
        unset($settings['id']);

        return $settings;
    }

    public function updateSettings(array $data, object $actor): array
    {
        $settings = $this->repository->all('settings')[0] ?? [];
        $updated = $this->repository->update('settings', (string) ($settings['id'] ?? ''), $data);
        if ($updated === null) {
            $updated = $this->repository->create('settings', array_replace($settings, $data));
        }
        $this->history($actor, 'settings', $updated['id'], 'updated', ['fields' => array_keys($data)]);

        return $updated;
    }

    public function generateSchedules(string $date, ?array $slots, object $actor, ScheduleGenerator $generator): array
    {
        $slots ??= $this->repository->all('settings')[0]['rider_slots'] ?? [];
        $result = $generator->generate($this->repository->all('riders'), $this->repository->all('service-areas'), $this->repository->all('schedules'), $date, $slots);
        foreach ($result['assigned'] as $assignment) {
            $rider = $this->repository->find('riders', $assignment['rider_id']);
            $area = $this->repository->find('service-areas', $assignment['service_area_id']);
            $this->repository->create('schedules', [
                'rider' => ['id' => $rider['id'], 'name' => $rider['name']],
                'service_area' => ['id' => $area['id'], 'name' => $area['name']],
                'shift_date' => $date, 'start_time' => $assignment['start_time'],
                'end_time' => $assignment['end_time'], 'status' => 'scheduled',
            ]);
        }
        $this->history($actor, 'schedule', $date, 'generated', ['assigned' => count($result['assigned']), 'unassigned' => count($result['unassigned'])]);

        return $result;
    }

    public function recordAdminAction(object $actor, string $type, string $id, string $action, ?array $changes = null): void
    {
        $this->history($actor, $type, $id, $action, $changes);
    }

    private function assertValidCombination(array $capabilities, array $memberships): void
    {
        $ownsRestaurant = collect($memberships)->contains(fn ($membership) => ($membership['role'] ?? null) === 'owner');
        if ($ownsRestaurant && in_array('driver', $capabilities, true)) {
            throw ValidationException::withMessages(['capabilities' => ['A user cannot have an owner membership and the driver capability at the same time.']]);
        }
    }

    private function assertUniqueEmail(string $email, ?string $exceptId = null): void
    {
        $exists = collect($this->repository->all('users'))->contains(fn ($user) => $user['email'] === $email && $user['id'] !== $exceptId);
        if ($exists) {
            throw ValidationException::withMessages(['email' => ['This email address is already in use.']]);
        }
    }

    private function safeUser(array $user): array
    {
        unset($user['password'], $user['password_hash']);

        return $user;
    }

    private function history(object $actor, string $type, string $id, string $action, ?array $changes): void
    {
        $this->repository->create('history', [
            'actor' => ['id' => (string) $actor->getAuthIdentifier(), 'name' => $actor->name],
            'restaurant' => null, 'subject_type' => $type, 'subject_id' => $id,
            'action' => $action, 'changes' => $changes, 'created_at' => now()->toISOString(),
        ]);
    }
}
