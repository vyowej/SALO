<?php

$boundsPath = dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'public'.DIRECTORY_SEPARATOR.'location-bounds.json';
$boundsJson = file_get_contents($boundsPath);
if ($boundsJson === false) {
    throw new RuntimeException('The Philippines coordinate bounds configuration is unavailable.');
}

return [
    'philippines_bounds' => json_decode($boundsJson, true, flags: JSON_THROW_ON_ERROR),
    'ncr_region_code' => '130000000',
    'geoapify_api_key' => env('LOCATION_GEOAPIFY_API_KEY'),
    'nominatim_user_agent' => env('LOCATION_NOMINATIM_USER_AGENT'),
    'provider_timeout_seconds' => (int) env('LOCATION_PROVIDER_TIMEOUT_SECONDS', 5),
    'provider_cache_minutes' => (int) env('LOCATION_PROVIDER_CACHE_MINUTES', 1440),
    'provider_lock_wait_seconds' => (int) env('LOCATION_PROVIDER_LOCK_WAIT_SECONDS', 15),
];
