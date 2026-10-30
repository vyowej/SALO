<?php

namespace App\Repositories\Database;

use App\Models\RestaurantApplication;
use App\Models\Restaurant;
use App\Repositories\Contracts\RestaurantApplicationRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Storage;

class DatabaseRestaurantApplicationRepository implements RestaurantApplicationRepository
{
    public function paginate(array $filters): array
    {
        $query = RestaurantApplication::query()->with(['applicant', 'documents']);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        $type = $filters['application_type'] ?? $filters['type'] ?? null;
        if ($type === 'restaurant') {
            $query->whereIn('application_type', ['initial', 'sensitive_update']);
        } elseif ($type === 'partner') {
            $query->where('application_type', 'initial');
        } elseif ($type !== null && $type !== '') {
            $query->where('application_type', $type);
        } else {
            $query->whereIn('application_type', ['initial', 'sensitive_update']);
        }
        if (empty($filters['status'])) {
            $query->where('status', '!=', 'draft');
        }
        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->whereHas('applicant', function (Builder $applicant) use ($search): void {
                $applicant->where('email', 'like', '%'.$search.'%')
                    ->orWhere('first_name', 'like', '%'.$search.'%')
                    ->orWhere('last_name', 'like', '%'.$search.'%');
            });
        }

        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 15)));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $paginator = $query->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $paginator->getCollection()->map(fn (RestaurantApplication $application): array => $this->toArray($application))->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => max(1, $paginator->lastPage()),
            ],
        ];
    }

    public function find(string $id): ?RestaurantApplication
    {
        if (! ctype_digit($id)) {
            return null;
        }

        return RestaurantApplication::query()->with(['applicant', 'documents'])->find($id);
    }

    public function findForApplicant(int $id, int $userId): ?RestaurantApplication
    {
        return RestaurantApplication::query()
            ->with('documents')
            ->whereKey($id)
            ->where('submitted_by', $userId)
            ->first();
    }

    public function findCurrentForApplicant(int $userId): ?RestaurantApplication
    {
        return RestaurantApplication::query()
            ->with('documents')
            ->where('submitted_by', $userId)
            ->where('application_type', 'initial')
            ->whereIn('status', ['draft', 'needs_revision', 'submitted', 'under_review'])
            ->latest('id')
            ->first();
    }

    public function findPendingSensitiveUpdate(int $restaurantId): ?RestaurantApplication
    {
        return RestaurantApplication::query()
            ->with('documents')
            ->where('restaurant_id', $restaurantId)
            ->where('application_type', 'sensitive_update')
            ->whereIn('status', ['draft', 'submitted', 'under_review', 'needs_revision'])
            ->latest('id')
            ->first();
    }

    public function create(array $attributes): RestaurantApplication
    {
        return RestaurantApplication::query()->create($attributes);
    }

    public function updateDraft(RestaurantApplication $application, array $details): RestaurantApplication
    {
        $application->forceFill(['draft_details' => $details])->save();

        return $application->load('documents');
    }

    public function updateSensitiveChanges(RestaurantApplication $application, array $changes): RestaurantApplication
    {
        return DB::transaction(function () use ($application, $changes): RestaurantApplication {
            $locked = RestaurantApplication::query()->lockForUpdate()->findOrFail($application->getKey());
            if ($locked->application_type !== 'sensitive_update'
                || ! in_array($locked->status, ['draft', 'needs_revision'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This sensitive update cannot be edited or resubmitted.'],
                ]);
            }
            $locked->forceFill([
                'proposed_changes' => $changes,
                'status' => 'submitted',
                'submitted_at' => now(),
                'reviewed_by' => null,
                'reviewed_at' => null,
                'review_notes' => null,
            ])->save();

            return $locked->load(['applicant', 'documents']);
        });
    }

    public function submit(RestaurantApplication $application): RestaurantApplication
    {
        return DB::transaction(function () use ($application): RestaurantApplication {
            $locked = RestaurantApplication::query()->lockForUpdate()->findOrFail($application->getKey());
            if (! in_array($locked->status, ['draft', 'needs_revision'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This application can no longer be submitted.'],
                ]);
            }
            $locked->forceFill([
                'status' => 'submitted',
                'submitted_at' => now(),
                'declared_bir_2303' => true,
            ])->save();

            return $locked->load(['applicant', 'documents']);
        });
    }

    public function transition(RestaurantApplication $application, string $status, string $note, int $reviewerId): RestaurantApplication
    {
        return DB::transaction(function () use ($application, $status, $note, $reviewerId): RestaurantApplication {
            $locked = RestaurantApplication::query()->lockForUpdate()->findOrFail($application->getKey());
            $allowedFrom = match ($status) {
                'under_review' => ['submitted'],
                'needs_revision', 'rejected' => ['submitted', 'under_review'],
                default => [],
            };
            if (! in_array($locked->status, $allowedFrom, true)) {
                throw ValidationException::withMessages([
                    'status' => ['This application cannot make that review transition.'],
                ]);
            }
            $locked->forceFill([
                'status' => $status,
                'reviewed_by' => $reviewerId,
                'reviewed_at' => now(),
                'review_notes' => $note,
            ])->save();

            return $locked->load(['applicant', 'documents']);
        });
    }

    public function approveInitial(RestaurantApplication $application, int $reviewerId): RestaurantApplication
    {
        return DB::transaction(function () use ($application, $reviewerId): RestaurantApplication {
            $locked = RestaurantApplication::query()->lockForUpdate()->findOrFail($application->getKey());
            if ($locked->restaurant_id !== null
                || $locked->application_type !== 'initial'
                || $locked->status !== 'under_review') {
                throw ValidationException::withMessages([
                    'status' => ['This application is no longer available for approval.'],
                ]);
            }

            $details = $locked->draft_details ?? [];
            $restaurant = Restaurant::query()->create([
                'owner_user_id' => $locked->submitted_by,
                'name' => $details['restaurant_name'],
                'description' => $details['description'] ?? null,
                'category' => $details['category'] ?? null,
                'contact_number' => $details['contact_number'] ?? null,
                'business_email' => $details['business_email'],
                'business_email_verified_at' => $details['business_email_verified_at'] ?? null,
                'psgc_code' => $details['psgc_code'],
                'street' => $details['street'],
                'latitude' => $details['latitude'],
                'longitude' => $details['longitude'],
                'logo_path' => $details['logo_path'] ?? null,
                'cover_path' => $details['cover_path'] ?? null,
                'is_24_7' => (bool) ($details['is_24_7'] ?? false),
                'status' => 'approved',
                'is_published' => false,
            ]);
            $cuisine = trim((string) ($details['cuisine'] ?? ''));
            if ($cuisine !== '') {
                $cuisineType = \App\Models\CuisineType::query()->firstOrCreate(['name' => $cuisine]);
                $restaurant->cuisines()->sync([$cuisineType->getKey()]);
            }

            $locked->forceFill([
                'restaurant_id' => $restaurant->getKey(),
                'status' => 'approved',
                'reviewed_by' => $reviewerId,
                'reviewed_at' => now(),
            ])->save();

            return $locked->load(['applicant', 'documents', 'restaurant']);
        });
    }

    public function approveSensitiveUpdate(RestaurantApplication $application, int $reviewerId): array
    {
        return DB::transaction(function () use ($application, $reviewerId): array {
            $locked = RestaurantApplication::query()->lockForUpdate()->findOrFail($application->getKey());
            if ($locked->application_type !== 'sensitive_update'
                || $locked->status !== 'under_review'
                || $locked->restaurant_id === null) {
                throw ValidationException::withMessages([
                    'status' => ['This sensitive update is no longer available for approval.'],
                ]);
            }

            $restaurant = Restaurant::query()->lockForUpdate()->findOrFail($locked->restaurant_id);
            $allowed = ['legal_name', 'psgc_code', 'street', 'latitude', 'longitude'];
            $changes = array_intersect_key($locked->proposed_changes ?? [], array_flip($allowed));
            $sensitiveDocuments = $locked->documents()->where('doc_type', 'business_permit')->get();
            if ($changes === [] && $sensitiveDocuments->isEmpty()) {
                throw ValidationException::withMessages([
                    'proposed_changes' => ['This sensitive update does not contain any supported changes.'],
                ]);
            }

            $before = array_intersect_key($restaurant->getAttributes(), $changes);
            if ($changes !== []) {
                $restaurant->forceFill($changes)->save();
            }
            $after = array_intersect_key($restaurant->fresh()->getAttributes(), $changes);
            $previousPermitDocuments = RestaurantApplication::query()
                ->where('restaurant_id', $restaurant->getKey())
                ->where('status', 'approved')
                ->where('id', '!=', $locked->getKey())
                ->with('documents')
                ->get()
                ->flatMap(fn (RestaurantApplication $approved): iterable => $approved->documents
                    ->where('doc_type', 'business_permit')
                    ->where('verification_state', 'verified')
                    ->map(fn ($document): array => [
                        'id' => (string) $document->getKey(),
                        'expiry_date' => $document->expiry_date?->toDateString(),
                    ]))
                ->values()
                ->all();
            if ($sensitiveDocuments->isNotEmpty()) {
                $sensitiveDocuments->each(function ($document): void {
                    $document->forceFill(['verification_state' => 'verified'])->save();
                });
                $before['permit_documents'] = $previousPermitDocuments;
                $after['permit_documents'] = $sensitiveDocuments->map(fn ($document): array => [
                    'id' => (string) $document->getKey(),
                    'expiry_date' => $document->expiry_date?->toDateString(),
                ])->values()->all();
            }
            $locked->forceFill([
                'status' => 'approved',
                'reviewed_by' => $reviewerId,
                'reviewed_at' => now(),
            ])->save();

            return [
                'application' => $locked->load(['applicant', 'documents', 'restaurant']),
                'before' => $before,
                'after' => $after,
            ];
        });
    }

    public function toArray(RestaurantApplication $application): array
    {
        $applicant = $application->applicant;
        $details = $application->draft_details ?? $application->proposed_changes ?? [];
        $logoPath = $details['logo_path'] ?? null;
        $coverPath = $details['cover_path'] ?? null;
        unset($details['logo_path'], $details['cover_path']);

        return [
            'id' => (string) $application->getKey(),
            'restaurant_id' => $application->restaurant_id === null ? null : (string) $application->restaurant_id,
            'type' => 'restaurant',
            'application_type' => $application->application_type,
            'status' => $application->status,
            'applicant' => [
                'id' => (string) $applicant->getKey(),
                'name' => $applicant->name,
                'email' => $applicant->email,
            ],
            'submitted_at' => $application->submitted_at?->toISOString(),
            'reviewed_by' => $application->reviewed_by === null ? null : (string) $application->reviewed_by,
            'reviewed_at' => $application->reviewed_at?->toISOString(),
            'review_note' => $application->review_notes,
            'details' => $details,
            'photos' => [
                'logo_url' => $logoPath ? Storage::disk('public')->url($logoPath) : null,
                'cover_url' => $coverPath ? Storage::disk('public')->url($coverPath) : null,
            ],
            'documents' => $application->documents->map(fn ($document): array => [
                'id' => (string) $document->getKey(),
                'doc_type' => $document->doc_type,
                'status' => $document->verification_state,
                'expiry_date' => $document->expiry_date?->toDateString(),
            ])->all(),
        ];
    }
}
