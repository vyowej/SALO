<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EnsureRestaurantMembership
{
    /**
     * Ensure the user is signed in and belongs to at least one active restaurant membership.
     */
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::user();

        if (! $user) {
            abort(401);
        }

        $memberships = $user->memberships ?? [];
        $hasActiveMembership = collect($memberships)->contains(fn ($membership) => (($membership['status'] ?? 'active') === 'active') || (($membership['status'] ?? 'active') === 'invited'));

        if (! $hasActiveMembership) {
            abort(404);
        }

        return $next($request);
    }
}
