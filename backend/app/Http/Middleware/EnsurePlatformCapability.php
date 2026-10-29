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

        return $next($request);
    }
}
