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
            function (PlatformSetting $setting): array {
                $value = (string) $setting->value;
                $decoded = json_decode($value, true);

                return [$setting->setting_key => json_last_error() === JSON_ERROR_NONE ? $decoded : $value];
            },
        )->all();
    }

    public function update(array $settings, int $userId): array
    {
        return DB::transaction(function () use ($settings, $userId): array {
            foreach ($settings as $key => $value) {
                $encodedValue = json_encode($value, JSON_THROW_ON_ERROR);
                if (mb_strlen($encodedValue) > 255) {
                    throw new \LengthException("The platform setting [{$key}] exceeds the database column limit.");
                }

                PlatformSetting::query()->updateOrCreate(
                    ['setting_key' => $key],
                    ['value' => $encodedValue, 'updated_by' => $userId, 'updated_at' => now()],
                );
            }

            return $this->all();
        });
    }
}
