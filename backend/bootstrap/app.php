<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->alias([
            'force.json' => \App\Http\Middleware\ForceJson::class,
            'capability' => \App\Http\Middleware\EnsurePlatformCapability::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (\Illuminate\Validation\ValidationException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => 'VALIDATION_FAILED',
                    'message' => 'The submitted data is invalid.',
                    'fields' => $exception->errors(),
                ],
            ], 422);
        });

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'Authentication is required.',
                ],
            ], 401);
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => 'FORBIDDEN',
                    'message' => 'You are not allowed to perform this action.',
                ],
            ], 403);
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $exception->getStatusCode();
            $details = match ($status) {
                404 => ['NOT_FOUND', 'The requested resource was not found.'],
                403 => ['FORBIDDEN', 'You are not allowed to perform this action.'],
                429 => ['RATE_LIMITED', 'Too many requests. Try again later.'],
                default => null,
            };

            if ($details === null) {
                return null;
            }

            return response()->json([
                'error' => [
                    'code' => $details[0],
                    'message' => $details[1],
                ],
            ], $status, $exception->getHeaders());
        });
    })->create();
