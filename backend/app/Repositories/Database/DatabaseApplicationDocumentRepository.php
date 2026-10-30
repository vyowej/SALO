<?php

namespace App\Repositories\Database;

use App\Models\ApplicationDocument;
use App\Repositories\Contracts\ApplicationDocumentRepository;

class DatabaseApplicationDocumentRepository implements ApplicationDocumentRepository
{
    public function find(int $id): ?ApplicationDocument
    {
        return ApplicationDocument::query()->with('application')->find($id);
    }

    public function findForApplication(int $id, int $applicationId): ?ApplicationDocument
    {
        return ApplicationDocument::query()
            ->whereKey($id)
            ->where('application_id', $applicationId)
            ->first();
    }

    public function create(array $attributes): ApplicationDocument
    {
        return ApplicationDocument::query()->create($attributes);
    }

    public function delete(ApplicationDocument $document): void
    {
        $document->delete();
    }
}
