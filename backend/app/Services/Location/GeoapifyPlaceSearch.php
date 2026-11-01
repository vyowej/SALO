<?php

namespace App\Services\Location;

use App\Exceptions\LocationProviderUnavailable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeoapifyPlaceSearch
{
    public function search(string $query, int $limit): array
    {
        $apiKey = trim((string) config('location.geoapify_api_key'));
        if ($apiKey === '') {
            throw new LocationProviderUnavailable('Street suggestions are not configured.');
        }

        try {
            $response = Http::acceptJson()
                ->timeout((int) config('location.provider_timeout_seconds'))
                ->get('https://api.geoapify.com/v1/geocode/search', [
                    'text' => $query,
                    'filter' => 'countrycode:ph',
                    'limit' => $limit,
                    'format' => 'json',
                    'apiKey' => $apiKey,
                ])
                ->throw();
        } catch (ConnectionException|RequestException $exception) {
            Log::warning('Location provider request failed.', [
                'provider' => 'geoapify',
                'exception' => $exception::class,
            ]);

            throw new LocationProviderUnavailable('Street suggestions are temporarily unavailable.');
        }

        $results = $response->json('results');
        if (! is_array($results)) {
            throw new LocationProviderUnavailable('Street suggestions returned an invalid response.');
        }

        return collect($results)
            ->filter(fn ($result): bool => is_array($result)
                && strtolower((string) ($result['country_code'] ?? '')) === 'ph'
                && is_numeric($result['lat'] ?? null)
                && is_numeric($result['lon'] ?? null))
            ->map(function (array $result): array {
                $formatted = (string) ($result['formatted'] ?? '');

                return [
                    'label' => (string) ($result['name'] ?? $result['street'] ?? $formatted),
                    'detail' => $formatted,
                    'street' => (string) ($result['street'] ?? ''),
                    'house_no' => (string) ($result['housenumber'] ?? ''),
                    'city_municipality' => (string) ($result['city'] ?? ''),
                    'barangay' => (string) ($result['suburb'] ?? $result['district'] ?? ''),
                    'latitude' => (float) $result['lat'],
                    'longitude' => (float) $result['lon'],
                ];
            })
            ->filter(fn (array $result): bool => $result['label'] !== '')
            ->take($limit)
            ->values()
            ->all();
    }
}
