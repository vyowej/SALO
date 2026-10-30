<?php

namespace App\Services;

use App\Models\ApplicationDocument;
use App\Models\RestaurantApplication;
use App\Models\User;
use App\Policies\ApplicationDocumentPolicy;
use App\Repositories\Contracts\ApplicationDocumentRepository;
use App\Repositories\Contracts\RestaurantApplicationRepository;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class ApplicationFileService
{
    private const DOCUMENT_TYPES = [
        'business_permit',
        'dti_sec_registration',
        'owner_valid_id',
        'halal_certificate',
    ];

    public function __construct(
        private readonly RestaurantApplicationRepository $applications,
        private readonly ApplicationDocumentRepository $documents,
        private readonly ApplicationDocumentPolicy $policy,
        private readonly PrivateDocumentStorageService $privateFiles,
        private readonly PublicPhotoStorageService $publicPhotos,
    ) {}

    public function storeDocument(
        User $user,
        int $applicationId,
        string $documentType,
        UploadedFile $file,
        ?string $expiryDate = null,
    ): ApplicationDocument {
        if (! in_array($documentType, self::DOCUMENT_TYPES, true)) {
            throw ValidationException::withMessages(['doc_type' => ['This document type is not supported.']]);
        }

        $application = $this->editableApplication($user, $applicationId);
        $path = $this->privateFiles->store($file);

        return $this->documents->create([
            'application_id' => $application->getKey(),
            'doc_type' => $documentType,
            'private_path' => $path,
            'expiry_date' => $expiryDate,
            'verification_state' => 'pending',
        ]);
    }

    public function storePhoto(User $user, int $applicationId, UploadedFile $file): string
    {
        $this->editableApplication($user, $applicationId);

        return $this->publicPhotos->store($file);
    }

    private function editableApplication(User $user, int $applicationId): RestaurantApplication
    {
        $application = $this->applications->findForApplicant(
            $applicationId,
            (int) $user->getKey(),
        );
        abort_unless(
            $application !== null && $this->policy->update($user, $application),
            404,
        );

        return $application;
    }
}
