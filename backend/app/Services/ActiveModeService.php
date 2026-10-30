<?php

namespace App\Services;

use App\Models\Restaurant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ActiveModeService
{
    public function activate(User $user, string $mode, ?string $restaurantId, Request $request): User
    {
        if (! in_array($mode, $user->capabilities, true)) {
            throw ValidationException::withMessages([
                'mode' => ['This account does not have access to the selected mode.'],
            ]);
        }

        if ($mode === 'business') {
            $restaurant = $restaurantId === null
                ? null
                : Restaurant::query()->find($restaurantId);
            if ($restaurant === null || $user->restaurantMembership($restaurant) === null) {
                throw ValidationException::withMessages([
                    'selected_restaurant_id' => ['Select an active restaurant membership.'],
                ]);
            }

            $request->session()->put('salo.selected_restaurant_id', (string) $restaurant->getKey());
        } else {
            $request->session()->forget('salo.selected_restaurant_id');
        }

        $request->session()->put('salo.active_mode', $mode);

        return $user->refresh();
    }
}
