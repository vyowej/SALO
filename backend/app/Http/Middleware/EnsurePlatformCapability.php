<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformCapability
{
    public function handle(Request $request, Closure $next, string $capability): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && in_array($capability, $user->capabilities ?? [], true), 403);
        $activeMode = $request->hasSession()
            ? (string) $request->session()->get('salo.active_mode', 'customer')
            : 'customer';
        $expectedMode = match ($capability) {
            'admin' => 'admin',
            'driver' => 'driver',
            'business' => 'business',
            default => 'customer',
        };
        abort_unless($activeMode === $expectedMode, 403);
        abort_if(
            $request->header('X-SALO-Mode') !== null
                && $request->header('X-SALO-Mode') !== $activeMode,
            403,
        );

        return $next($request);
    }
}
