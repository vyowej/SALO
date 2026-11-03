<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\RiderProfile;
use App\Models\User;
use App\Notifications\RiderActivationNotification;
use App\Repositories\Contracts\PlatformSettingsRepository;
use App\Repositories\Contracts\RiderApplicationRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class RiderApplicationService
{
    public function __construct(
        private readonly AddressFormatter $addressFormatter,
        private readonly PrivateRiderDocumentStorageService $privateFiles,
        private readonly AuthTokenService $tokens,
        private readonly RiderApplicationRepository $riders,
        private readonly PlatformSettingsRepository $settings,
    ) {}

    public function getOrCreate(User $user): RiderProfile
    {
        return DB::transaction(function () use ($user): RiderProfile {
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();
            $profile = $this->riders->profiles()->where('user_id', $user->getKey())->lockForUpdate()->first();
            if ($profile === null) {
                $profile = $this->riders->profiles()->create(['user_id' => $user->getKey()]);

                return $this->loadProfile($profile->getKey());
            }

            if ($profile->application_status === 'rejected') {
                $this->assertCoolingOffElapsed($profile->updated_at, 'rider_reapply_cooldown_days');
                $this->deleteDocumentTypes($profile, ['profile_photo', 'id_photo', 'drivers_license', 'or_cr']);
                $profile->forceFill([
                    'application_status' => 'draft',
                    'status' => null,
                    'approved_by' => null,
                    'approved_at' => null,
                    'submitted_at' => null,
                    'review_notes' => null,
                ])->save();
            } elseif ($profile->status === 'resigned') {
                $this->assertCoolingOffElapsed($profile->resigned_at, 'rider_reapply_cooldown_days');
                $profile->forceFill([
                    'application_status' => 'draft',
                    'status' => null,
                    'approved_by' => null,
                    'approved_at' => null,
                    'resigned_at' => null,
                    'submitted_at' => null,
                    'review_notes' => null,
                ])->save();
            }

            return $this->loadProfile($profile->getKey());
        });
    }

    public function hasProfile(User $user): bool
    {
        return $this->riders->profiles()->where('user_id', $user->getKey())->exists();
    }

    public function findForUser(User $user): RiderProfile
    {
        $profile = $this->riders->profiles()->where('user_id', $user->getKey())->firstOrFail();

        return $this->loadProfile($profile->getKey());
    }

    public function findForApplicant(User $user, int $riderId): RiderProfile
    {
        $profile = $this->riders->profiles()
            ->whereKey($riderId)
            ->where('user_id', $user->getKey())
            ->firstOrFail();

        return $this->loadProfile($profile->getKey());
    }

    public function updateDraft(User $user, int $riderId, array $data): RiderProfile
    {
        $profile = $this->findForApplicant($user, $riderId);
        abort_unless(in_array($profile->application_status, ['draft', 'needs_revision'], true), 409);

        return DB::transaction(function () use ($user, $profile, $data): RiderProfile {
            $locked = $this->riders->profiles()->whereKey($profile->getKey())->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->application_status, ['draft', 'needs_revision'], true), 409);

            $userFields = array_intersect_key($data, array_flip([
                'first_name', 'middle_name', 'last_name', 'suffix', 'birthday', 'mobile',
            ]));
            if (isset($userFields['birthday']) && Carbon::parse($userFields['birthday'])->gt(now()->subYears(18))) {
                throw ValidationException::withMessages(['birthday' => ['Riders must be at least 18 years old.']]);
            }
            if ($userFields !== []) {
                $user->forceFill($userFields)->save();
            }

            $profileFields = array_intersect_key($data, array_flip([
                'vehicle_type', 'psgc_code', 'street', 'house_no', 'home_lat', 'home_lng',
                'plate_number', 'ewallet_account_name', 'declared_clearance_tin',
            ]));

            if (array_key_exists('psgc_code', $profileFields) && $profileFields['psgc_code'] !== null) {
                $location = $this->riders->locations()->find($profileFields['psgc_code']);
                if ($location === null || $location->level !== 'barangay') {
                    throw ValidationException::withMessages(['psgc_code' => ['Choose a barangay-level location.']]);
                }
            } else {
                $location = $locked->psgc_code === null ? null : $this->riders->locations()->find($locked->psgc_code);
            }

            $street = array_key_exists('street', $profileFields) ? $profileFields['street'] : $locked->street;
            $houseNumber = array_key_exists('house_no', $profileFields) ? $profileFields['house_no'] : $locked->house_no;
            $psgcCode = array_key_exists('psgc_code', $profileFields) ? $profileFields['psgc_code'] : $locked->psgc_code;
            if ($psgcCode && trim((string) $street) !== '') {
                $location ??= $this->riders->locations()->findOrFail($psgcCode);
                $profileFields['formatted_address'] = $this->addressFormatter->format($location, (string) $street, $houseNumber);
            } else {
                $profileFields['formatted_address'] = null;
            }

            if (($profileFields['vehicle_type'] ?? $locked->vehicle_type) !== 'motorcycle') {
                $profileFields['plate_number'] = null;
                $this->deleteDocumentTypes($locked, ['drivers_license', 'or_cr']);
            }
            if (array_key_exists('preferred_shift_ids', $data)) {
                $locked->preferredShifts()->sync($data['preferred_shift_ids']);
            }
            $locked->forceFill($profileFields)->save();

            return $this->loadProfile($locked->getKey());
        });
    }

    public function uploadDocument(User $user, int $riderId, string $docType, UploadedFile $file): RiderProfile
    {
        $profile = $this->findForApplicant($user, $riderId);
        abort_unless(in_array($profile->application_status, ['draft', 'needs_revision'], true), 409);
        if (in_array($docType, ['drivers_license', 'or_cr'], true) && $profile->vehicle_type !== 'motorcycle') {
            throw ValidationException::withMessages(['doc_type' => ['Motorcycle documents are only required for motorcycle riders.']]);
        }

        $path = $this->privateFiles->store($file, (int) $profile->getKey(), $docType);
        try {
            $oldPath = DB::transaction(function () use ($profile, $docType, $path): ?string {
                $document = $this->riders->documents()
                    ->where('rider_id', $profile->getKey())
                    ->where('doc_type', $docType)
                    ->lockForUpdate()
                    ->first();
                $oldPath = $document?->private_path;
                if ($document === null) {
                    $this->riders->documents()->create([
                        'rider_id' => $profile->getKey(),
                        'doc_type' => $docType,
                        'private_path' => $path,
                    ]);
                } else {
                    $document->forceFill(['private_path' => $path, 'verified' => false])->save();
                }

                return $oldPath;
            });
        } catch (Throwable $exception) {
            Storage::disk('private')->delete($path);
            throw $exception;
        }

        if ($oldPath !== null && $oldPath !== $path) {
            $this->privateFiles->delete($oldPath, (int) $profile->getKey(), $docType);
        }

        return $this->loadProfile($profile->getKey());
    }

    public function deleteDocument(User $user, int $riderId, int $documentId): void
    {
        $profile = $this->findForApplicant($user, $riderId);
        abort_unless(in_array($profile->application_status, ['draft', 'needs_revision'], true), 409);
        $document = $this->riders->documents()
            ->whereKey($documentId)
            ->where('rider_id', $profile->getKey())
            ->firstOrFail();
        $path = $document->private_path;
        $docType = $document->doc_type;

        DB::transaction(fn () => $document->delete());
        $this->privateFiles->delete($path, (int) $profile->getKey(), $docType);
    }

    public function createDocumentDownloadUrl(User $user, int $riderId, int $documentId): string
    {
        $profile = $this->riders->profiles()->whereKey($riderId)->firstOrFail();
        abort_unless(
            (int) $profile->user_id === (int) $user->getKey()
                || $user->platformAdmin()->where('status', 'active')->exists(),
            403,
        );
        $document = $this->riders->documents()
            ->whereKey($documentId)
            ->where('rider_id', $profile->getKey())
            ->firstOrFail();
        abort_unless($this->privateFiles->isSafePath($document->private_path, (int) $profile->getKey(), $document->doc_type), 404);

        return \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'api.v1.private-rider-documents.download',
            now()->addMinutes(5),
            ['document' => $document->getKey()],
        );
    }

    public function streamDocument(User $user, int $documentId): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $document = $this->riders->documents()->with('rider')->findOrFail($documentId);
        abort_unless(
            (int) $document->rider->user_id === (int) $user->getKey()
                || $user->platformAdmin()->where('status', 'active')->exists(),
            403,
        );
        abort_unless($this->privateFiles->isSafePath(
            $document->private_path,
            (int) $document->rider_id,
            $document->doc_type,
        ), 404);

        $disk = Storage::disk('private');
        abort_unless($disk->exists($document->private_path), 404);
        $stream = $disk->readStream($document->private_path);
        if (! is_resource($stream)) {
            throw new \RuntimeException('The private rider document could not be opened.');
        }

        $mime = str_ends_with($document->private_path, '.pdf') ? 'application/pdf' : 'image/jpeg';

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="rider-document.'.($mime === 'application/pdf' ? 'pdf' : 'jpg').'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function submit(User $user, int $riderId): RiderProfile
    {
        $profile = $this->findForApplicant($user, $riderId);
        abort_unless(in_array($profile->application_status, ['draft', 'needs_revision'], true), 409);

        return DB::transaction(function () use ($user, $profile): RiderProfile {
            $locked = $this->riders->profiles()->whereKey($profile->getKey())->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->application_status, ['draft', 'needs_revision'], true), 409);
            $this->validateSubmission($user, $locked);
            $location = $this->riders->locations()->findOrFail($locked->psgc_code);
            $beforeStatus = $locked->application_status;
            $locked->forceFill([
                'formatted_address' => $this->addressFormatter->format($location, (string) $locked->street, $locked->house_no),
                'application_status' => 'submitted',
                'submitted_at' => now(),
                'review_notes' => null,
            ])->save();
            $this->audit($user, $locked, 'rider_application_submitted', [
                'before_status' => $beforeStatus,
                'application_status' => 'submitted',
                'terms_version' => 'rider-terms-v1',
                'terms_accepted_at' => now()->toISOString(),
            ]);

            return $this->loadProfile($locked->getKey());
        });
    }

    public function adminList(array $filters): array
    {
        $query = $this->riders->profiles()->with(['user', 'documents'])
            ->whereIn('application_status', ['submitted', 'under_review', 'needs_revision']);
        if (! empty($filters['status'])) {
            $query->where('application_status', $filters['status']);
        }
        if (! empty($filters['search'])) {
            $search = trim($filters['search']);
            $query->whereHas('user', fn (Builder $builder) => $builder
                ->where('first_name', 'like', '%'.$search.'%')
                ->orWhere('last_name', 'like', '%'.$search.'%')
                ->orWhere('email', 'like', '%'.$search.'%'));
        }

        $total = (clone $query)->count();
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 15)));
        $items = $query->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get()
            ->map(fn (RiderProfile $profile): array => [
                'id' => (string) $profile->getKey(),
                'application_status' => $profile->application_status,
                'submitted_at' => $profile->submitted_at?->toISOString(),
                'vehicle_type' => $profile->vehicle_type,
                'applicant' => [
                    'name' => $profile->user->name,
                    'email' => $profile->user->email,
                ],
                'document_count' => $profile->documents->count(),
            ])
            ->all();

        return [
            'data' => $items,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => max(1, (int) ceil($total / $perPage)),
            ],
        ];
    }

    public function findForReview(int $riderId): RiderProfile
    {
        return $this->loadProfile($riderId);
    }

    public function startReview(int $riderId, User $admin, ?string $note): RiderProfile
    {
        return $this->reviewTransition($riderId, $admin, 'under_review', $note, 'rider_application_review_started');
    }

    public function reject(int $riderId, User $admin, string $note): RiderProfile
    {
        return $this->reviewTransition($riderId, $admin, 'rejected', $note, 'rider_application_rejected');
    }

    public function requestRevision(int $riderId, User $admin, string $note): RiderProfile
    {
        return $this->reviewTransition($riderId, $admin, 'needs_revision', $note, 'rider_application_revision_requested');
    }

    public function approve(int $riderId, User $admin, ?string $note): array
    {
        $profile = DB::transaction(function () use ($riderId, $admin, $note): RiderProfile {
            $locked = $this->riders->profiles()->whereKey($riderId)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->application_status, ['submitted', 'under_review'], true), 422);
            $this->validateSubmission($locked->user, $locked);
            $beforeStatus = $locked->application_status;
            $locked->forceFill([
                'application_status' => 'approved',
                'status' => 'pending_activation',
                'approved_by' => $admin->getKey(),
                'approved_at' => now(),
                'review_notes' => $note,
            ])->save();
            $this->audit($admin, $locked, 'rider_application_approved', [
                'before_status' => $beforeStatus,
                'application_status' => 'approved',
                'status' => 'pending_activation',
                'note' => $note,
            ]);

            return $this->loadProfile($locked->getKey());
        });

        return [
            'profile' => $profile,
            'email_delivery' => $this->sendActivationCode($profile),
        ];
    }

    public function sendActivationCode(RiderProfile $profile): array
    {
        abort_unless($profile->application_status === 'approved' && $profile->status === 'pending_activation', 409);
        $user = $profile->user;
        $code = $this->tokens->issueOtp($user, 'rider_activation', $user->email);
        try {
            $user->notify(new RiderActivationNotification($code));
        } catch (Throwable $exception) {
            Log::error('Rider activation email delivery failed.', [
                'rider_id' => $profile->getKey(),
                'exception' => $exception::class,
            ]);

            return [
                'sent' => false,
                'message' => 'The rider is approved, but the activation email could not be sent. Try again after the resend cooldown.',
                ...($this->localCopyCode($code)),
            ];
        }

        return [
            'sent' => true,
            'message' => 'An activation code was sent to the rider email address.',
            ...($this->localCopyCode($code)),
        ];
    }

    public function verifyActivation(User $user, RiderProfile $profile, string $code): RiderProfile
    {
        $this->tokens->verifyRiderActivation($user, (int) $profile->getKey(), $code);

        return $this->loadProfile($profile->getKey());
    }

    private function reviewTransition(int $riderId, User $admin, string $status, ?string $note, string $action): RiderProfile
    {
        return DB::transaction(function () use ($riderId, $admin, $status, $note, $action): RiderProfile {
            $profile = $this->riders->profiles()->whereKey($riderId)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($profile->application_status, ['submitted', 'under_review'], true), 422);
            $beforeStatus = $profile->application_status;
            $profile->forceFill(['application_status' => $status, 'review_notes' => $note])->save();
            $this->audit($admin, $profile, $action, [
                'before_status' => $beforeStatus,
                'application_status' => $status,
                'note' => $note,
            ]);

            return $this->loadProfile($profile->getKey());
        });
    }

    private function validateSubmission(User $user, RiderProfile $profile): void
    {
        $documents = $profile->documents()->pluck('doc_type')->all();
        $validator = Validator::make([
            'vehicle_type' => $profile->vehicle_type,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'birthday' => $user->birthday?->toDateString(),
            'mobile' => $user->mobile,
            'preferred_shift_ids' => $profile->preferredShifts()->pluck('shifts.id')->all(),
            'psgc_code' => $profile->psgc_code,
            'street' => $profile->street,
            'ewallet_account_name' => $profile->ewallet_account_name,
            'declared_clearance_tin' => $profile->declared_clearance_tin,
            'profile_photo' => in_array('profile_photo', $documents, true),
            'id_photo' => in_array('id_photo', $documents, true),
            'drivers_license' => in_array('drivers_license', $documents, true),
            'or_cr' => in_array('or_cr', $documents, true),
        ], [
            'vehicle_type' => ['required', Rule::in(['motorcycle', 'bicycle', 'e_scooter', 'walker'])],
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'birthday' => ['required', 'date', 'before_or_equal:'.now()->subYears(18)->toDateString()],
            'mobile' => ['required', 'string', 'max:20'],
            'preferred_shift_ids' => ['required', 'array', 'min:1'],
            'psgc_code' => ['required', Rule::exists('psgc_locations', 'code')->where('level', 'barangay')],
            'street' => ['required', 'string', 'max:190'],
            'ewallet_account_name' => ['required', 'string', 'max:120'],
            'declared_clearance_tin' => ['accepted'],
            'profile_photo' => ['accepted'],
            'id_photo' => ['accepted'],
            'drivers_license' => $profile->vehicle_type === 'motorcycle'
                ? ['required', 'accepted']
                : ['nullable'],
            'or_cr' => $profile->vehicle_type === 'motorcycle'
                ? ['required', 'accepted']
                : ['nullable'],
        ]);
        $validator->validate();

        if ($profile->vehicle_type === 'motorcycle' && trim((string) $profile->plate_number) === '') {
            throw ValidationException::withMessages(['plate_number' => ['Enter the motorcycle plate number.']]);
        }
    }

    private function deleteDocumentTypes(RiderProfile $profile, array $types): void
    {
        $documents = $profile->documents()->whereIn('doc_type', $types)->get();
        foreach ($documents as $document) {
            $path = $document->private_path;
            $type = $document->doc_type;
            $document->delete();
            $this->privateFiles->delete($path, (int) $profile->getKey(), $type);
        }
    }

    private function assertCoolingOffElapsed(?Carbon $endedAt, string $settingKey): void
    {
        $days = $this->setting($settingKey, 30);
        if ($endedAt !== null && $endedAt->gt(now()->subDays($days))) {
            throw ValidationException::withMessages([
                'application' => ["You may apply again after the {$days}-day rider cooling-off period."],
            ]);
        }
    }

    private function setting(string $key, int $default): int
    {
        $value = $this->settings->all()[$key] ?? null;
        if (! is_string($value)) {
            return is_numeric($value) ? max(1, (int) $value) : $default;
        }
        $decoded = json_decode($value, true);

        return is_numeric($decoded) ? max(1, (int) $decoded) : (is_numeric($value) ? max(1, (int) $value) : $default);
    }

    private function localCopyCode(string $code): array
    {
        return app()->environment('local') ? ['local_copy_code' => $code] : [];
    }

    private function audit(User $actor, RiderProfile $profile, string $action, array $after): void
    {
        $before = array_key_exists('before_status', $after)
            ? ['application_status' => $after['before_status']]
            : null;
        unset($after['before_status']);
        AuditLog::query()->create([
            'actor_user_id' => $actor->getKey(),
            'action' => $action,
            'entity_type' => 'rider_profile',
            'entity_id' => $profile->getKey(),
            'before_value' => $before,
            'after_value' => $after,
            'created_at' => now(),
        ]);
    }

    private function loadProfile(int|string $riderId): RiderProfile
    {
        return $this->riders->profiles()
            ->with(['user', 'location.parent.parent.parent', 'documents', 'preferredShifts'])
            ->findOrFail($riderId);
    }
}
