<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'notifications' => (bool) $this['notifications'],
            'promotions' => (bool) $this['promotions'],
            'reservationReminders' => (bool) $this['reservationReminders'],
            'darkMode' => (bool) $this['darkMode'],
            'soundAlerts' => (bool) $this['soundAlerts'],
        ];
    }
}
