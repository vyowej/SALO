<?php

namespace App\Repositories\Database;

use App\Models\SessionRecord;
use App\Repositories\Contracts\SessionRepository;

class DatabaseSessionRepository implements SessionRepository
{
    public function deleteForUser(int $userId): void
    {
        if (config('session.driver') !== 'database') {
            return;
        }

        SessionRecord::query()->where('user_id', $userId)->delete();
    }
}
