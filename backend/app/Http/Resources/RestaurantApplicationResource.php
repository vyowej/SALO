<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class RestaurantApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $details = $this->draft_details ?? [];
        $logoPath = $details['logo_path'] ?? null;
        $coverPath = $details['cover_path'] ?? null;
        unset($details['logo_path'], $details['cover_path']);

        return [
            'id' => (string) $this->getKey(),
            'status' => $this->status,
            'application_type' => $this->application_type,
            'details' => $details,
            'photos' => [
                'logo_url' => $logoPath ? Storage::disk('public')->url($logoPath) : null,
                'cover_url' => $coverPath ? Storage::disk('public')->url($coverPath) : null,
            ],
            'documents' => $this->documents->map(fn ($document): array => [
                'id' => (string) $document->getKey(),
                'doc_type' => $document->doc_type,
                'expiry_date' => $document->expiry_date?->toDateString(),
                'status' => $document->verification_state,
            ])->values(),
            'review_notes' => $this->review_notes,
            'submitted_at' => $this->submitted_at?->toISOString(),
            'restaurant_id' => $this->restaurant_id === null ? null : (string) $this->restaurant_id,
        ];
    }
}
