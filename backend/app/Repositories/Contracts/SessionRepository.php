<?php

namespace App\Repositories\Contracts;

interface SessionRepository
{
    public function deleteForUser(int $userId): void;
}
