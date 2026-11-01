<?php

namespace App\Services\Location;

use App\Exceptions\LocationProviderUnavailable;
use Illuminate\Cache\LockTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class NominatimReverseGeocoder
{
    public function reverse(float $latitude, float $longitude): array
    {
        $userAgent = trim((string) config('location.nominatim_user_agent'));
        if ($userAgent === '') {
            throw new LocationProviderUnavailable('Reverse geocoding is not configured.');
        }

        $cacheKey = 'location:nominatim:'.hash('sha256', sprintf('%.5F,%.5F', $latitude, $longitude));

        return Cache::remember(
            $cacheKey,
            now()->addMinutes(max(1, (int) config('location.provider_cache_minutes'))),
            fn (): array => $this->rateLimitedRequest($latitude, $longitude, $userAgent),
        );
    }

    private function rateLimitedRequest(float $latitude, float $longitude, string $userAgent): array
    {
        $timeout = max(1, (int) config('location.provider_timeout_seconds'));
        $lock = Cache::lock('location:nominatim:application-rate-limit', $timeout + 2);

        try {
            return $lock->block((int) config('location.provider_lock_wait_seconds'), function () use (
                $latitude,
                $longitude,
                $timeout,
                $userAgent,
            ): array {
                $startedAt = microtime(true);

                try {
                    $response = Http::acceptJson()
                        ->withUserAgent($userAgent)
                        ->timeout($timeout)
                        ->get('https://nominatim.openstreetmap.org/reverse', [
                            'format' => 'jsonv2',
                            'addressdetails' => 1,
                            'lat' => $latitude,
                            'lon' => $longitude,
                        ])
                        ->throw();
                } catch (ConnectionException|RequestException $exception) {
                    Log::warning('Location provider request failed.', [
                        'provider' => 'nominatim',
                        'exception' => $exception::class,
                    ]);

                    throw new LocationProviderUnavailable('Reverse geocoding is temporarily unavailable.');
                } finally {
                    $remainingMicroseconds = (int) ((1 - (microtime(true) - $startedAt)) * 1_000_000);
                    if ($remainingMicroseconds > 0) {
                        usleep($remainingMicroseconds);
                    }
                }

                $result = $response->json();
                if (! is_array($result) || ! is_array($result['address'] ?? null)) {
                    throw new LocationProviderUnavailable('Reverse geocoding returned an invalid response.');
                }

                return $result;
            });
        } catch (LockTimeoutException) {
            throw new LocationProviderUnavailable('Reverse geocoding is busy. Please try again shortly.');
        }
    }
}
