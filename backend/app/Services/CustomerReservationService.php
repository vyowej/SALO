<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\Restaurant;
use App\Models\User;
use App\Repositories\Contracts\CustomerReservationRepository;
use App\Repositories\Contracts\RestaurantDiscoveryRepository;
use App\Repositories\Contracts\ReservationRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerReservationService
{
    public function __construct(
        private readonly CustomerReservationRepository $customerReservations,
        private readonly RestaurantDiscoveryRepository $restaurants,
        private readonly ReservationRepository $reservations,
        private readonly ReservationAvailabilityService $availability,
    ) {}

    public function slots(Restaurant $restaurant, string $date, int $guestCount, ?int $durationMinutes): array
    {
        return $this->availability->availableSlots($restaurant, $date, $guestCount, $durationMinutes);
    }

    public function publicRestaurant(int $restaurantId): Restaurant
    {
        return $this->publicRestaurantOrFail($restaurantId);
    }

    public function create(int $userId, array $data): Reservation
    {
        return DB::transaction(function () use ($userId, $data): Reservation {
            $customer = User::query()->lockForUpdate()->findOrFail($userId);
            abort_unless($customer->status === 'active' && $customer->email_verified_at !== null, 403);
            if ($this->customerReservations->countActiveForCustomer($userId) >= 3) {
                throw ValidationException::withMessages([
                    'reservation' => ['You can have up to three active reservations at a time.'],
                ]);
            }

            $restaurant = $this->publicRestaurantOrFail((int) $data['restaurant_id']);
            $reservation = $this->availability->createReservation($restaurant, $customer, $data);
            return $this->customerReservations->findForCustomer($userId, (int) $reservation->getKey())
                ?? throw new \RuntimeException('The newly created reservation could not be reloaded.');
        });
    }

    public function list(int $userId, array $filters): LengthAwarePaginator
    {
        return $this->customerReservations->paginateForCustomer($userId, $filters);
    }

    public function find(int $userId, int $reservationId): Reservation
    {
        $reservation = $this->customerReservations->findForCustomer($userId, $reservationId);
        abort_unless($reservation instanceof Reservation, 404);

        return $reservation;
    }

    public function cancel(int $userId, int $reservationId, ?string $reason): Reservation
    {
        return DB::transaction(function () use ($userId, $reservationId, $reason): Reservation {
            User::query()->lockForUpdate()->findOrFail($userId);
            $reservation = $this->customerReservations->findForCustomer($userId, $reservationId, true);
            abort_unless($reservation instanceof Reservation, 404);
            if (! in_array($reservation->status, ['pending', 'confirmed'], true)) {
                throw ValidationException::withMessages([
                    'reservation' => ['Only Pending or Confirmed reservations can be cancelled.'],
                ]);
            }
            if ($reservation->status === 'pending' && $reservation->expires_at?->isPast()) {
                throw ValidationException::withMessages([
                    'reservation' => ['This pending reservation has expired.'],
                ]);
            }

            $restaurant = $reservation->table?->restaurant;
            abort_unless($restaurant instanceof Restaurant, 404);
            $settings = $this->reservations->settings($restaurant);
            $cutoffHours = (int) ($settings?->cancel_cutoff_hours ?? 2);
            if (now()->gte($reservation->start_at->copy()->subHours($cutoffHours))) {
                throw ValidationException::withMessages([
                    'reservation' => ['This reservation is inside the restaurant’s cancellation cutoff.'],
                ]);
            }

            $reservation = $this->reservations->updateReservation($reservation, [
                'status' => 'cancelled',
                'cancelled_by' => $userId,
                'cancel_reason' => $reason === null ? null : trim($reason),
                'expires_at' => null,
            ]);

            return $this->customerReservations->findForCustomer($userId, (int) $reservation->getKey())
                ?? throw new \RuntimeException('The cancelled reservation could not be reloaded.');
        });
    }

    private function publicRestaurantOrFail(int $restaurantId): Restaurant
    {
        $restaurant = $this->restaurants->findPublic($restaurantId);
        abort_unless($restaurant instanceof Restaurant, 404);

        return $restaurant;
    }
}
