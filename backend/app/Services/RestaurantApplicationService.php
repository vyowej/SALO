<?php

namespace App\Services;

use App\Models\ApplicationDocument;
use App\Models\RestaurantApplication;
use App\Models\User;
use App\Notifications\BusinessEmailOtpNotification;
use App\Policies\RestaurantApplicationPolicy;
use App\Repositories\Contracts\ApplicationDocumentRepository;
use App\Repositories\Contracts\RestaurantApplicationRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class RestaurantApplicationService
{
    public function __construct(
        private readonly RestaurantApplicationRepository $applications,
        private readonly ApplicationDocumentRepository $documents,
        private readonly RestaurantApplicationPolicy $policy,
        private readonly ApplicationFileService $files,
        private readonly AuthTokenService $tokens,
    ) {}

    public function getOrCreate(User $user): RestaurantApplication
    {
        return DB::transaction(function () use ($user): RestaurantApplication {
            User::query()->lockForUpdate()->findOrFail($user->getKey());

            return $this->applications->findCurrentForApplicant((int) $user->getKey())
                ?? $this->applications->create([
                    'submitted_by' => $user->getKey(),
                    'application_type' => 'initial',
                    'status' => 'draft',
                    'draft_details' => [],
                    'declared_bir_2303' => false,
                ]);
        });
    }

    public function findForApplicant(User $user, int $applicationId): RestaurantApplication
    {
        $application = $this->applications->findForApplicant($applicationId, (int) $user->getKey());
        abort_unless($application !== null && $this->policy->view($user, $application), 404);

        return $application;
    }

    public function update(User $user, int $applicationId, array $newDetails): RestaurantApplication
    {
        $application = $this->findForApplicant($user, $applicationId);
        abort_unless($this->policy->update($user, $application), 403);

        $details = array_replace($application->draft_details ?? [], $newDetails);
        $email = isset($newDetails['business_email'])
            ? mb_strtolower(trim($newDetails['business_email']))
            : null;
        if ($email !== null
            && ($details['business_email_verified_email'] ?? null) !== $email) {
            $details['business_email_verified'] = false;
            $details['business_email_verified_email'] = null;
            $details['business_email_verified_at'] = null;
        }
        if (isset($details['business_email'])) {
            $details['business_email'] = mb_strtolower(trim($details['business_email']));
        }

        return $this->applications->updateDraft($application, $details);
    }

    public function sendBusinessEmailOtp(User $user, int $applicationId): void
    {
        $application = $this->findForApplicant($user, $applicationId);
        abort_unless($this->policy->update($user, $application), 403);
        $email = mb_strtolower(trim((string) data_get($application->draft_details, 'business_email')));
        if ($email === '') {
            throw ValidationException::withMessages([
                'business_email' => ['Enter the business email before requesting a code.'],
            ]);
        }

        $code = $this->tokens->issueOtp($user, 'business_email', $email);
        Notification::route('mail', $email)->notify(new BusinessEmailOtpNotification($code));
    }

    public function verifyBusinessEmail(User $user, int $applicationId, string $code): RestaurantApplication
    {
        $application = $this->findForApplicant($user, $applicationId);
        abort_unless($this->policy->update($user, $application), 403);
        $email = mb_strtolower(trim((string) data_get($application->draft_details, 'business_email')));
        if ($email === '') {
            throw ValidationException::withMessages([
                'business_email' => ['Enter the business email before verifying it.'],
            ]);
        }

        $this->tokens->verifyOtp($user, 'business_email', $code, $email);
        $details = $application->draft_details ?? [];
        $details['business_email_verified'] = true;
        $details['business_email_verified_email'] = $email;
        $details['business_email_verified_at'] = now()->toISOString();

        return $this->applications->updateDraft($application, $details);
    }

    public function uploadDocument(User $user, int $applicationId, string $type, \Illuminate\Http\UploadedFile $file, ?string $expiryDate): ApplicationDocument
    {
        return $this->files->storeDocument($user, $applicationId, $type, $file, $expiryDate);
    }

    public function deleteDocument(User $user, int $applicationId, int $documentId): void
    {
        $application = $this->findForApplicant($user, $applicationId);
        abort_unless($this->policy->update($user, $application), 403);
        $document = $application->documents->firstWhere('id', $documentId);
        abort_unless($document instanceof ApplicationDocument, 404);
        if (! Storage::disk('private')->delete($document->private_path)) {
            throw new \RuntimeException('The application document could not be removed from private storage.');
        }
        $this->documents->delete($document);
    }

    public function uploadPhoto(User $user, int $applicationId, string $kind, \Illuminate\Http\UploadedFile $file): RestaurantApplication
    {
        $application = $this->findForApplicant($user, $applicationId);
        abort_unless($this->policy->update($user, $application), 403);
        $path = $this->files->storePhoto($user, $applicationId, $file);
        $details = $application->draft_details ?? [];
        $key = $kind === 'logo' ? 'logo_path' : 'cover_path';
        $previousPath = $details[$key] ?? null;
        $details[$key] = $path;

        $updated = $this->applications->updateDraft($application, $details);

        if ($previousPath && $previousPath !== $path && ! Storage::disk('public')->delete($previousPath)) {
            throw new \RuntimeException('The replaced application photo could not be removed.');
        }

        return $updated;
    }

    public function submit(User $user, int $applicationId, bool $declaredBir): RestaurantApplication
    {
        $application = $this->findForApplicant($user, $applicationId);
        abort_unless($this->policy->submit($user, $application), 403);
        $details = $application->draft_details ?? [];
        $errors = [];

        foreach ([
            'restaurant_name' => 'Enter the restaurant name.',
            'category' => 'Choose a restaurant category.',
            'contact_number' => 'Enter a contact number.',
            'business_email' => 'Enter a business email.',
            'psgc_code' => 'Choose a PSGC location.',
            'street' => 'Enter the street address.',
        ] as $key => $message) {
            if (! is_string($details[$key] ?? null) || trim($details[$key]) === '') {
                $errors['draft_details.'.$key] = [$message];
            }
        }
        if (! is_numeric($details['latitude'] ?? null) || ! is_numeric($details['longitude'] ?? null)) {
            $errors['draft_details.latitude'] = ['Place the restaurant pin on the map.'];
        }
        $businessEmail = mb_strtolower(trim((string) ($details['business_email'] ?? '')));
        if (($details['business_email_verified'] ?? false) !== true
            || ($details['business_email_verified_email'] ?? null) !== $businessEmail) {
            $errors['draft_details.business_email'] = ['Verify the current business email before submitting.'];
        }
        if (! $declaredBir) {
            $errors['declared_bir_2303'] = ['Confirm the BIR 2303 self-declaration.'];
        }
        $documentTypes = $application->documents->pluck('doc_type')->unique()->all();
        foreach (['business_permit', 'dti_sec_registration', 'owner_valid_id'] as $requiredType) {
            if (! in_array($requiredType, $documentTypes, true)) {
                $errors['documents'] = ['Upload the business permit, DTI/SEC registration, and owner valid ID.'];
                break;
            }
        }

        if (! ($details['is_24_7'] ?? false)) {
            $this->validateHours($details['hours'] ?? [], $errors);
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $this->applications->submit($application);
    }

    private function validateHours(array $hours, array &$errors): void
    {
        $openDays = 0;
        foreach ($hours as $day => $shifts) {
            $dailyMinutes = 0;
            foreach ($shifts as $shift) {
                $start = $this->minutes((string) ($shift['open_time'] ?? ''));
                $end = $this->minutes((string) ($shift['close_time'] ?? ''));
                if ($start === null || $end === null) {
                    $errors['draft_details.hours.'.$day] = ['Choose valid opening and closing times.'];
                    continue;
                }
                if (($shift['crosses_midnight'] ?? false) === true) {
                    $end += 1440;
                }
                if ($end <= $start) {
                    $errors['draft_details.hours.'.$day] = ['Closing time must be after opening time; mark overnight shifts.'];
                    continue;
                }
                $dailyMinutes += $end - $start;
            }

            if ($dailyMinutes > 0) {
                $openDays++;
                if ($dailyMinutes < 240) {
                    $errors['draft_details.hours.'.$day] = ['Each open day must include at least four hours.'];
                }
            }
        }

        if ($openDays < 5) {
            $errors['draft_details.hours'] = ['Add opening hours for at least five days per week, or select Open 24/7.'];
        }
    }

    private function minutes(string $time): ?int
    {
        if (! preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $time, $matches)) {
            return null;
        }

        return ((int) $matches[1] * 60) + (int) $matches[2];
    }
}
