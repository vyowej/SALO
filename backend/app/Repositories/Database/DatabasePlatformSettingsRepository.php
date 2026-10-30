<?php

namespace App\Repositories\Database;

use App\Models\PlatformSetting;
use App\Repositories\Contracts\PlatformSettingsRepository;
use Illuminate\Support\Facades\DB;

class DatabasePlatformSettingsRepository implements PlatformSettingsRepository
{
    public function all(): array
    {
        return PlatformSetting::query()->get()->mapWithKeys(
            fn (PlatformSetting $setting): array => [$setting->setting_key => $setting->value],
        )->all();
    }

    public function update(array $settings, int $adminId): array
    {
        return DB::transaction(function () use ($settings, $adminId): array {
            foreach ($settings as $key => $value) {
                PlatformSetting::query()->updateOrCreate(
                    ['setting_key' => $key],
                    ['value' => $value, 'updated_by' => $adminId, 'updated_at' => now()],
                );
            }

            return $this->all();
        });
    }
}
