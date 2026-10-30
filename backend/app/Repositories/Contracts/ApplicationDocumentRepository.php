<?php

namespace App\Repositories\Contracts;

use App\Models\ApplicationDocument;

interface ApplicationDocumentRepository
{
    public function find(int $id): ?ApplicationDocument;

    public function findForApplication(int $id, int $applicationId): ?ApplicationDocument;

    public function create(array $attributes): ApplicationDocument;

    public function delete(ApplicationDocument $document): void;
}
