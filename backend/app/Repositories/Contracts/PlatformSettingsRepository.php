<?php

namespace App\Repositories\Contracts;

interface PlatformSettingsRepository
{
    public function all(): array;

    public function update(array $settings, int $userId): array;
}
