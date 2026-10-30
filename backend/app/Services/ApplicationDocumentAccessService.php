<?php

namespace App\Services;

use App\Models\ApplicationDocument;
use App\Models\User;
use App\Policies\ApplicationDocumentPolicy;
use App\Repositories\Contracts\ApplicationDocumentRepository;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApplicationDocumentAccessService
{
    public function __construct(
        private readonly ApplicationDocumentRepository $documents,
        private readonly ApplicationDocumentPolicy $policy,
    ) {}

    public function createTemporaryUrl(User $user, int $documentId): string
    {
        $document = $this->authorizedDocument($user, $documentId);

        return URL::temporarySignedRoute(
            'api.v1.private-documents.download',
            now()->addMinutes(5),
            ['document' => $document->getKey()],
        );
    }

    public function download(User $user, int $documentId): StreamedResponse
    {
        $document = $this->authorizedDocument($user, $documentId);
        abort_unless(Storage::disk('private')->exists($document->private_path), 404);

        return Storage::disk('private')->download(
            $document->private_path,
            basename($document->private_path),
        );
    }

    private function authorizedDocument(User $user, int $documentId): ApplicationDocument
    {
        $document = $this->documents->find($documentId);
        abort_unless(
            $document !== null && $this->policy->view($user, $document->application),
            404,
        );

        return $document;
    }
}
