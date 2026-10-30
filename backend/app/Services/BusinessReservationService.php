<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\ReservationSetting;
use App\Models\Restaurant;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\ReservationRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BusinessReservationService
{
    private const SETTINGS_FIELDS = [
        'accepts_reservations',
        'confirm_mode',
        'review_window_hours',
        'slot_minutes',
        'dining_minutes',
        'min_lead_hours',
        'max_months_ahead',
        'max_party_size',
        'grace_minutes',
        'cancel_cutoff_hours',
    ];

    public function __construct(
        private readonly ReservationRepository $reservations,
        private readonly RestaurantPageRepository $restaurants,
        private readonly ReservationAvailabilityService $availability,
        private readonly AuditLogRepository $audit,
    ) {}

    public function tables(Restaurant $restaurant): array
    {
        return $this->reservations->tables($restaurant)
            ->map(fn (RestaurantTable $table): array => $this->tableArray($table))
            ->all();
    }

    public function createTable(Restaurant $restaurant, User $actor, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $data): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $table = $this->reservations->createTable($lockedRestaurant, [
                'table_number' => trim($data['table_number']),
                'capacity' => (int) $data['capacity'],
                'area' => isset($data['area']) ? trim($data['area']) : null,
                'status' => $data['status'] ?? 'active',
            ]);
            $result = $this->tableArray($table);
            $this->record($actor, $lockedRestaurant, 'restaurant_table.created', 'restaurant_table', (string) $table->getKey(), null, $result);

            return $result;
        });
    }

    public function updateTable(Restaurant $restaurant, User $actor, int $tableId, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $tableId, $data): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $table = $this->reservations->lockTable($lockedRestaurant, $tableId);
            abort_unless($table !== null, 404);
            $attributes = array_intersect_key($data, array_flip(['table_number', 'capacity', 'area', 'status']));
            if (isset($attributes['table_number'])) {
                $attributes['table_number'] = trim($attributes['table_number']);
            }
            if (array_key_exists('area', $attributes)) {
                $attributes['area'] = trim((string) $attributes['area']) ?: null;
            }

            $beforeStatus = $table->status;
            $before = $table->only(array_keys($attributes));
            $updated = $this->reservations->updateTable($table, $attributes);
            $attentionCount = 0;
            if (($attributes['status'] ?? null) === 'maintenance' && $beforeStatus !== 'maintenance') {
                $attentionCount = $this->reservations->countAffectedReservations($updated);
                $this->reservations->notifyOwnerOfMaintenance($lockedRestaurant, $updated);
            } elseif (isset($attributes['capacity']) && (int) $attributes['capacity'] < (int) $before['capacity']) {
                $attentionCount = $this->reservations->countAffectedReservations(
                    $updated,
                    (int) $attributes['capacity'],
                );
            }

            $after = $updated->only(array_keys($attributes));
            if ($before !== $after) {
                $this->record(
                    $actor,
                    $lockedRestaurant,
                    'restaurant_table.updated',
                    'restaurant_table',
                    (string) $tableId,
                    $before,
                    $after,
                );
            }

            return $this->tableArray($updated) + ['affected_reservations' => $attentionCount];
        });
    }

    public function deleteTable(Restaurant $restaurant, User $actor, int $tableId): void
    {
        DB::transaction(function () use ($restaurant, $actor, $tableId): void {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $table = $this->reservations->lockTable($lockedRestaurant, $tableId);
            abort_unless($table !== null, 404);
            if ($this->reservations->hasReservationHistory($table)) {
                throw ValidationException::withMessages([
                    'table' => ['Tables with reservation history cannot be deleted. Set the table to Inactive instead.'],
                ]);
            }
            $before = $this->tableArray($table);
            $this->reservations->deleteTable($table);
            $this->record($actor, $lockedRestaurant, 'restaurant_table.deleted', 'restaurant_table', (string) $tableId, $before, null);
        });
    }

    public function settings(Restaurant $restaurant): array
    {
        $setting = $this->reservations->settings($restaurant);
        $values = $setting?->only(self::SETTINGS_FIELDS) ?? [
            'accepts_reservations' => false,
            'confirm_mode' => 'manual',
            'review_window_hours' => null,
            'slot_minutes' => null,
            'dining_minutes' => null,
            'min_lead_hours' => null,
            'max_months_ahead' => null,
            'max_party_size' => null,
            'grace_minutes' => null,
            'cancel_cutoff_hours' => null,
        ];

        return $values + ['is_configured' => $this->isConfigured($setting)];
    }

    public function updateSettings(Restaurant $restaurant, User $actor, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $data): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $before = $this->settings($lockedRestaurant);
            $setting = $this->reservations->saveSettings(
                $lockedRestaurant,
                array_intersect_key($data, array_flip(self::SETTINGS_FIELDS)),
            );
            $after = $this->settingsArray($setting);
            if ($before !== $after) {
                $this->record($actor, $lockedRestaurant, 'reservation.settings.updated', 'reservation_settings', (string) $lockedRestaurant->getKey(), $before, $after);
            }

            return $after;
        });
    }

    public function list(Restaurant $restaurant, array $filters): array
    {
        $page = $this->reservations->paginateReservations($restaurant, $filters);

        return [
            'data' => $page->getCollection()
                ->map(fn (Reservation $reservation): array => $this->reservationArray($reservation))
                ->all(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ];
    }

    public function show(Restaurant $restaurant, int $reservationId): array
    {
        $reservation = $this->reservations->findReservation($restaurant, $reservationId);
        abort_unless($reservation instanceof Reservation, 404);

        return $this->reservationArray($reservation);
    }

    public function updateStatus(
        Restaurant $restaurant,
        User $actor,
        int $reservationId,
        string $toStatus,
        ?string $reason,
    ): array {
        return DB::transaction(function () use ($restaurant, $actor, $reservationId, $toStatus, $reason): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $reservation = $this->reservations->findReservation($lockedRestaurant, $reservationId, true);
            abort_unless($reservation instanceof Reservation, 404);
            $transitions = [
                'pending' => ['confirmed', 'declined', 'cancelled'],
                'confirmed' => ['completed', 'cancelled', 'no_show'],
            ];
            if (! in_array($toStatus, $transitions[$reservation->status] ?? [], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This reservation cannot move from its current status to the requested status.'],
                ]);
            }
            if (in_array($toStatus, ['declined', 'cancelled'], true) && trim((string) $reason) === '') {
                throw ValidationException::withMessages(['reason' => ['A reason is required to decline or cancel a reservation.']]);
            }
            if ($toStatus === 'no_show') {
                $settings = $this->reservations->settings($lockedRestaurant);
                if ($settings?->grace_minutes === null) {
                    throw ValidationException::withMessages(['status' => ['Set a grace period before marking reservations No Show.']]);
                }
                if (now()->lt($reservation->start_at->copy()->addMinutes((int) $settings->grace_minutes))) {
                    throw ValidationException::withMessages(['status' => ['The reservation grace period has not elapsed.']]);
                }
            }

            $before = $this->reservationAuditArray($reservation);
            $reason = $reason === null ? null : trim($reason);
            $attributes = ['status' => $toStatus];
            if (in_array($toStatus, ['confirmed', 'declined'], true)) {
                $attributes['responded_by'] = $actor->getKey();
                $attributes['expires_at'] = null;
            }
            if ($toStatus === 'declined') {
                $attributes['response_reason'] = $reason;
            }
            if ($toStatus === 'cancelled') {
                $attributes['cancelled_by'] = $actor->getKey();
                $attributes['cancel_reason'] = $reason;
                $attributes['expires_at'] = null;
            }
            if ($toStatus === 'no_show') {
                $attributes['responded_by'] = $actor->getKey();
            }
            $updated = $this->reservations->updateReservation($reservation, $attributes);
            $after = $this->reservationAuditArray($updated);
            $this->record($actor, $lockedRestaurant, 'reservation.status.changed', 'reservation', (string) $reservationId, $before, $after);
            if ($toStatus === 'confirmed') {
                $this->reservations->notifyReservationUser(
                    $updated,
                    'reservation.confirmed',
                    'Your reservation '.$updated->reference_code.' is confirmed.',
                );
            } elseif ($toStatus === 'declined') {
                $this->reservations->notifyReservationUser(
                    $updated,
                    'reservation.declined',
                    'Your reservation '.$updated->reference_code.' was declined: '.$reason,
                );
            } elseif ($toStatus === 'cancelled') {
                $this->reservations->notifyReservationUser(
                    $updated,
                    'reservation.cancelled',
                    'Your reservation '.$updated->reference_code.' was cancelled: '.$reason,
                );
            }

            return $this->reservationArray($updated);
        });
    }

    public function reschedule(Restaurant $restaurant, User $actor, int $reservationId, array $data): array
    {
        return DB::transaction(function () use ($restaurant, $actor, $reservationId, $data): array {
            $lockedRestaurant = $this->restaurants->lockRestaurant((int) $restaurant->getKey());
            $reservation = $this->reservations->findReservation($lockedRestaurant, $reservationId, true);
            abort_unless($reservation instanceof Reservation, 404);
            if (! in_array($reservation->status, ['pending', 'confirmed'], true)) {
                throw ValidationException::withMessages(['status' => ['Only Pending or Confirmed reservations can be rescheduled.']]);
            }
            $settings = $this->reservations->settings($lockedRestaurant);
            $startAt = \Illuminate\Support\Carbon::parse($data['start_at'])->utc();
            $duration = (int) ($data['duration_minutes'] ?? $reservation->duration_minutes);
            $table = $this->availability->lockAvailableTable(
                $lockedRestaurant,
                $settings,
                $startAt,
                $duration,
                (int) $reservation->guest_count,
                isset($data['table_id']) ? (int) $data['table_id'] : null,
                (int) $reservation->getKey(),
            );

            $before = $this->reservationAuditArray($reservation);
            $updated = $this->reservations->updateReservation($reservation, [
                'table_id' => $table->getKey(),
                'start_at' => $startAt,
                'duration_minutes' => $duration,
                'expires_at' => $reservation->status === 'pending'
                    ? now()->addHours((int) $settings->review_window_hours)
                    : null,
            ]);
            $after = $this->reservationAuditArray($updated);
            $this->record($actor, $lockedRestaurant, 'reservation.rescheduled', 'reservation', (string) $reservationId, $before, $after);
            $this->reservations->notifyReservationUser(
                $updated,
                'reservation.rescheduled',
                'Your reservation '.$updated->reference_code.' was rescheduled to '.$updated->start_at->toISOString().'.',
            );

            return $this->reservationArray($updated);
        });
    }

    public function expirePending(): int
    {
        $expiredCount = 0;
        foreach ($this->reservations->duePendingReservations(now()) as $candidate) {
            $table = $candidate->table;
            if (! $table instanceof RestaurantTable) {
                continue;
            }
            $expired = DB::transaction(function () use ($candidate, $table): bool {
                $restaurant = $this->restaurants->lockRestaurant((int) $table->restaurant_id);
                $reservation = $this->reservations->findReservation($restaurant, (int) $candidate->getKey(), true);
                if (
                    ! $reservation instanceof Reservation
                    || $reservation->status !== 'pending'
                    || $reservation->expires_at === null
                    || $reservation->expires_at->isFuture()
                ) {
                    return false;
                }
                $this->reservations->updateReservation($reservation, ['status' => 'expired']);

                return true;
            });
            $expiredCount += $expired ? 1 : 0;
        }

        return $expiredCount;
    }

    private function tableArray(RestaurantTable $table): array
    {
        return [
            'id' => (string) $table->getKey(),
            'table_number' => $table->table_number,
            'capacity' => $table->capacity,
            'area' => $table->area,
            'status' => $table->status,
            'attention_count' => (int) ($table->attention_count ?? 0),
        ];
    }

    private function reservationArray(Reservation $reservation): array
    {
        $endAt = $reservation->start_at->copy()->addMinutes((int) $reservation->duration_minutes);

        return [
            'id' => (string) $reservation->getKey(),
            'reference_code' => $reservation->reference_code,
            'customer' => [
                'name' => $reservation->reserved_for_name,
                'phone' => $reservation->contact_phone,
            ],
            'table_id' => (string) $reservation->table_id,
            'table' => $reservation->table === null ? null : [
                'table_number' => $reservation->table->table_number,
                'area' => $reservation->table->area,
                'status' => $reservation->table->status,
            ],
            'start_at' => $reservation->start_at->toISOString(),
            'end_at' => $endAt->toISOString(),
            'duration_minutes' => (int) $reservation->duration_minutes,
            'guest_count' => (int) $reservation->guest_count,
            'special_request' => $reservation->special_request,
            'status' => $reservation->status,
            'expires_at' => $reservation->expires_at?->toISOString(),
            'response_reason' => $reservation->response_reason,
            'cancel_reason' => $reservation->cancel_reason,
            'created_at' => $reservation->created_at?->toISOString(),
        ];
    }

    private function reservationAuditArray(Reservation $reservation): array
    {
        return [
            'status' => $reservation->status,
            'table_id' => (string) $reservation->table_id,
            'start_at' => $reservation->start_at->toISOString(),
            'duration_minutes' => (int) $reservation->duration_minutes,
            'guest_count' => (int) $reservation->guest_count,
            'response_reason' => $reservation->response_reason,
            'cancel_reason' => $reservation->cancel_reason,
        ];
    }

    private function settingsArray(ReservationSetting $setting): array
    {
        $array = $setting->only(self::SETTINGS_FIELDS);

        return $array + ['is_configured' => $this->isConfigured($setting)];
    }

    private function isConfigured(?ReservationSetting $setting): bool
    {
        return $setting !== null
            && $setting->review_window_hours !== null
            && $setting->slot_minutes !== null
            && $setting->dining_minutes !== null
            && $setting->min_lead_hours !== null
            && $setting->max_months_ahead !== null
            && $setting->max_party_size !== null
            && $setting->grace_minutes !== null
            && $setting->cancel_cutoff_hours !== null;
    }

    private function record(
        User $actor,
        Restaurant $restaurant,
        string $action,
        string $entityType,
        string $entityId,
        ?array $before,
        ?array $after,
    ): void {
        $this->audit->record([
            'actor_user_id' => $actor->getKey(),
            'restaurant_id' => $restaurant->getKey(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }
}
