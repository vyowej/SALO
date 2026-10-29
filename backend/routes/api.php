<?php

use App\Http\Controllers\Api\V1\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Api\V1\Auth\CurrentAccountController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Auth\RegisteredUserController;
use App\Http\Controllers\Api\V1\Customer\AddressController;
use App\Http\Controllers\Api\V1\Customer\ProfileController;
use App\Http\Controllers\Api\V1\Customer\SettingsController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('force.json')->group(function (): void {
    Route::middleware('guest:web')->group(function (): void {
        Route::post('/auth/register', [RegisteredUserController::class, 'store']);
        Route::post('/auth/login', [AuthenticatedSessionController::class, 'store'])
            ->middleware('throttle:auth-login');
        Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgot'])
            ->middleware('throttle:auth-recovery');
        Route::post('/auth/reset-password', [PasswordResetController::class, 'reset'])
            ->middleware('throttle:auth-recovery');
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthenticatedSessionController::class, 'destroy']);
        Route::get('/auth/me', [CurrentAccountController::class, 'show']);
        Route::post('/auth/email/verification/send', [EmailVerificationController::class, 'send'])
            ->middleware('throttle:auth-recovery');
        Route::post('/auth/email/verification/verify', [EmailVerificationController::class, 'verify'])
            ->middleware('throttle:auth-recovery');

        Route::middleware('capability:customer')->prefix('customer')->group(function (): void {
            Route::get('/profile', [ProfileController::class, 'show']);
            Route::patch('/profile', [ProfileController::class, 'update']);
            Route::delete('/profile', [ProfileController::class, 'destroy']);
            Route::get('/settings', [SettingsController::class, 'show']);
            Route::patch('/settings', [SettingsController::class, 'update']);

            Route::get('/addresses', [AddressController::class, 'index']);
            Route::post('/addresses', [AddressController::class, 'store']);
            Route::patch('/addresses/{address}', [AddressController::class, 'update']);
            Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);
            Route::patch('/addresses/{address}/primary', [AddressController::class, 'setPrimary']);
        });
    });
});
