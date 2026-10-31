<?php

$boundsPath = dirname(__DIR__, 2).DIRECTORY_SEPARATOR.'public'.DIRECTORY_SEPARATOR.'location-bounds.json';
$boundsJson = file_get_contents($boundsPath);
if ($boundsJson === false) {
    throw new RuntimeException('The Philippines coordinate bounds configuration is unavailable.');
}

return [
    'philippines_bounds' => json_decode($boundsJson, true, flags: JSON_THROW_ON_ERROR),
];
