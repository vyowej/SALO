<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Repositories\Contracts\RiderApplicationRepository;

class RiderProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing(['user', 'location.parent.parent.parent', 'documents', 'preferredShifts']);
        $user = $this->user;
        $location = $this->location;
        $hierarchy = collect();
        $current = $location;
        while ($current !== null && $hierarchy->count() < 5) {
            $hierarchy->push($current);
            $current = $current->parent;
        }
        $region = $hierarchy->firstWhere('level', 'region');
        $province = $hierarchy->firstWhere('level', 'province');
        $city = $hierarchy->first(fn ($item) => in_array($item->level, ['city', 'submunicipality'], true));
        $barangay = $hierarchy->firstWhere('level', 'barangay');

        return [
            'id' => (string) $this->getKey(),
            'application_status' => $this->application_status,
            'status' => $this->status,
            'vehicle_type' => $this->vehicle_type,
            'plate_number' => $this->plate_number,
            'applicant' => [
                'first_name' => $user->first_name,
                'middle_name' => $user->middle_name,
                'last_name' => $user->last_name,
                'suffix' => $user->suffix,
                'name' => $user->name,
                'email' => $user->email,
                'birthday' => $user->birthday?->toDateString(),
                'mobile' => $user->mobile,
            ],
            'address' => [
                'country_code' => $this->country_code,
                'psgc_code' => $this->psgc_code,
                'psgc_full_name' => $location?->full_name,
                'region' => $region?->name,
                'region_code' => $region?->code,
                'province' => $province?->name,
                'province_code' => $province?->code,
                'city_municipality' => $city?->name,
                'city_code' => $city?->code,
                'barangay' => $barangay?->name,
                'street' => $this->street,
                'house_no' => $this->house_no,
                'formatted_address' => $this->formatted_address,
                'latitude' => $this->home_lat,
                'longitude' => $this->home_lng,
            ],
            'preferred_shifts' => $this->preferredShifts->map(fn ($shift): array => [
                'id' => (string) $shift->getKey(),
                'name' => $shift->name,
                'start_time' => substr((string) $shift->start_time, 0, 5),
                'end_time' => substr((string) $shift->end_time, 0, 5),
            ])->values(),
            'available_shifts' => app(RiderApplicationRepository::class)->shifts()->orderBy('start_time')->get()
                ->map(fn ($shift): array => [
                    'id' => (string) $shift->getKey(),
                    'name' => $shift->name,
                    'start_time' => substr((string) $shift->start_time, 0, 5),
                    'end_time' => substr((string) $shift->end_time, 0, 5),
                ])->values(),
            'ewallet_account_name' => $this->ewallet_account_name,
            'declared_clearance_tin' => (bool) $this->declared_clearance_tin,
            'documents' => $this->documents->map(fn ($document): array => [
                'id' => (string) $document->getKey(),
                'doc_type' => $document->doc_type,
                'mime_type' => str_ends_with($document->private_path, '.pdf') ? 'application/pdf' : 'image/jpeg',
                'verified' => (bool) $document->verified,
                'created_at' => $document->created_at?->toISOString(),
            ])->values(),
            'review_notes' => $this->review_notes,
            'submitted_at' => $this->submitted_at?->toISOString(),
            'approved_at' => $this->approved_at?->toISOString(),
        ];
    }
}
