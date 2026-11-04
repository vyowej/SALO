<?php

namespace App\Services;

use App\Models\Delivery;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class RiderLocationCache
{
    private const TTL_SECONDS = 120;

    public function store(Delivery $delivery, int $riderId, float $latitude, float $longitude): array
    {
        $recordedAt = now()->toIso8601String();
        $expiresAt = now()->addSeconds(self::TTL_SECONDS)->toIso8601String();
        $location = [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'updated_at' => $recordedAt,
        ];

        Cache::put($this->deliveryKey((int) $delivery->getKey(), $riderId), $location, now()->addSeconds(self::TTL_SECONDS));
        Cache::put($this->dispatchKey($riderId), $location, now()->addSeconds(self::TTL_SECONDS));

        return [
            'recorded_at' => $recordedAt,
            'expires_at' => $expiresAt,
        ];
    }

    public function latest(Delivery $delivery, int $riderId): ?array
    {
        $location = Cache::get($this->deliveryKey((int) $delivery->getKey(), $riderId));
        if (! is_array($location)
            || ! is_numeric($location['latitude'] ?? null)
            || ! is_numeric($location['longitude'] ?? null)
            || ! is_string($location['updated_at'] ?? null)) {
            return null;
        }

        $recordedAt = Carbon::parse($location['updated_at']);
        if ($recordedAt->isFuture() || $recordedAt->lte(now()->subSeconds(self::TTL_SECONDS))) {
            $this->forgetDelivery($delivery, $riderId);

            return null;
        }

        return [
            'latitude' => (float) $location['latitude'],
            'longitude' => (float) $location['longitude'],
            'updated_at' => $location['updated_at'],
        ];
    }

    public function forgetDelivery(Delivery $delivery, int $riderId): void
    {
        Cache::forget($this->deliveryKey((int) $delivery->getKey(), $riderId));
    }

    public function forgetProfile(int $riderId): void
    {
        Cache::forget($this->dispatchKey($riderId));

        Delivery::query()
            ->where('rider_id', $riderId)
            ->whereIn('status', ['offered', 'accepted', 'picked_up'])
            ->pluck('id')
            ->each(fn ($deliveryId) => Cache::forget($this->deliveryKey((int) $deliveryId, $riderId)));
    }

    public function forgetForRider(int $riderId, Delivery $delivery): void
    {
        $this->forgetDelivery($delivery, $riderId);
        Cache::forget($this->dispatchKey($riderId));
    }

    private function deliveryKey(int $deliveryId, int $riderId): string
    {
        return "rider:delivery:{$deliveryId}:profile:{$riderId}:location";
    }

    private function dispatchKey(int $riderId): string
    {
        return "rider:{$riderId}:dispatch-location";
    }
}
