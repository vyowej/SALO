<?php

namespace App\Repositories\Contracts;

use App\Models\RestaurantApplication;

interface RestaurantApplicationRepository
{
    public function paginate(array $filters): array;

    public function find(string $id): ?RestaurantApplication;

    public function findForApplicant(int $id, int $userId): ?RestaurantApplication;

    public function findCurrentForApplicant(int $userId): ?RestaurantApplication;

    public function create(array $attributes): RestaurantApplication;

    public function updateDraft(RestaurantApplication $application, array $details): RestaurantApplication;

    public function submit(RestaurantApplication $application): RestaurantApplication;

    public function transition(RestaurantApplication $application, string $status, string $note, int $reviewerId): RestaurantApplication;

    public function approveInitial(RestaurantApplication $application, int $reviewerId): RestaurantApplication;

    public function toArray(RestaurantApplication $application): array;
}
