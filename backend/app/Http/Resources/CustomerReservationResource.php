<?php

namespace App\Http\Resources;

use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerReservationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var Reservation $reservation */
        $reservation = $this->resource;
        $table = $reservation->table;
        $restaurant = $table?->restaurant;
        $cutoffHours = (int) ($restaurant?->reservationSetting?->cancel_cutoff_hours ?? 2);
        $canCancel = in_array($reservation->status, ['pending', 'confirmed'], true)
            && ! ($reservation->status === 'pending' && $reservation->expires_at?->isPast())
            && now()->lt($reservation->start_at->copy()->subHours($cutoffHours));

        return [
            'id' => (string) $reservation->getKey(),
            'reference_code' => $reservation->reference_code,
            'restaurant_id' => (string) $restaurant?->getKey(),
            'restaurant' => [
                'id' => (string) $restaurant?->getKey(),
                'name' => $restaurant?->name,
                'formatted_address' => $restaurant?->formatted_address,
            ],
            'table_id' => (string) $reservation->table_id,
            'table' => $table === null ? null : [
                'table_number' => $table->table_number,
                'area' => $table->area,
                'capacity' => (int) $table->capacity,
            ],
            'start_at' => $reservation->start_at?->toISOString(),
            'end_at' => $reservation->start_at?->copy()->addMinutes((int) $reservation->duration_minutes)->toISOString(),
            'duration_minutes' => (int) $reservation->duration_minutes,
            'guest_count' => (int) $reservation->guest_count,
            'reserved_for_name' => $reservation->reserved_for_name,
            'contact_phone' => $reservation->contact_phone,
            'special_request' => $reservation->special_request,
            'status' => $reservation->status,
            'expires_at' => $reservation->expires_at?->toISOString(),
            'cancel_reason' => $reservation->cancel_reason,
            'can_cancel' => $canCancel,
            'created_at' => $reservation->created_at?->toISOString(),
        ];
    }
}
