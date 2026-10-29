<?php

use App\Http\Controllers\Api\V1\Admin\AdminController;
use App\Http\Controllers\Api\V1\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Api\V1\Business\BusinessController;
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

        Route::middleware('capability:admin')->prefix('admin')->group(function (): void {
            Route::get('/dashboard', [AdminController::class, 'dashboard']);
            foreach (['users', 'restaurants', 'riders', 'orders', 'reservations', 'service-areas'] as $resource) {
                Route::get('/'.$resource, [AdminController::class, 'index'])->defaults('resource', $resource);
                Route::get('/'.$resource.'/{id}', [AdminController::class, 'show'])->defaults('resource', $resource);
            }
            foreach (['users', 'restaurants', 'service-areas'] as $resource) {
                Route::post('/'.$resource, [AdminController::class, 'store'])->defaults('resource', $resource);
                Route::put('/'.$resource.'/{id}', [AdminController::class, 'update'])->defaults('resource', $resource);
                Route::delete('/'.$resource.'/{id}', [AdminController::class, 'destroy'])->defaults('resource', $resource);
            }
            Route::post('/users/{id}/suspend', [AdminController::class, 'userSuspend']);
            Route::post('/users/{id}/reactivate', [AdminController::class, 'userReactivate']);
            Route::patch('/restaurants/{id}/status', [AdminController::class, 'restaurantStatus']);
            Route::get('/applications', [AdminController::class, 'index'])->defaults('resource', 'applications');
            Route::get('/applications/{type}/{id}', [AdminController::class, 'show'])->defaults('resource', 'applications');
            Route::post('/applications/{type}/{id}/approve', [AdminController::class, 'applicationApprove']);
            Route::post('/applications/{type}/{id}/reject', [AdminController::class, 'applicationReject']);
            Route::patch('/riders/{id}/status', [AdminController::class, 'riderStatus']);
            Route::get('/riders/{id}/proofs', [AdminController::class, 'riderProofs']);
            Route::post('/orders/{id}/cancel', [AdminController::class, 'cancelOrder']);
            Route::patch('/reservations/{id}/status', [AdminController::class, 'reservationStatus']);
            Route::get('/reports/{report}', [AdminController::class, 'report'])->whereIn('report', ['sales', 'orders-by-status', 'restaurant-ranking', 'rider-performance']);
            Route::get('/history', [AdminController::class, 'history']);
            Route::get('/calendar', [AdminController::class, 'calendar']);
            Route::get('/settings', [AdminController::class, 'settings']);
            Route::put('/settings', [AdminController::class, 'updateSettings'])->defaults('resource', 'settings');
            Route::get('/schedules', [AdminController::class, 'index'])->defaults('resource', 'schedules');
            Route::post('/schedules/generate', [AdminController::class, 'generateSchedule']);
        });

        Route::middleware(['auth:sanctum', 'restaurant.member'])->prefix('business')->group(function (): void {
            Route::get('/dashboard', [BusinessController::class, 'dashboard']);
            Route::get('/orders', [BusinessController::class, 'orders']);
            Route::get('/orders/{id}', [BusinessController::class, 'orderDetail']);
            Route::patch('/orders/{id}/status', [BusinessController::class, 'updateOrderStatus']);
            Route::get('/menu', [BusinessController::class, 'menu']);
            Route::get('/reservations', [BusinessController::class, 'reservations']);
            Route::get('/tables', [BusinessController::class, 'tables']);
            Route::get('/calendar', [BusinessController::class, 'calendar']);
            Route::get('/profile', [BusinessController::class, 'profile']);
            Route::get('/hours', [BusinessController::class, 'hours']);
            Route::get('/staff', [BusinessController::class, 'staff']);
            Route::get('/reports/{report}', [BusinessController::class, 'reports'])->whereIn('report', ['sales', 'orders-by-status', 'top-items']);
            Route::get('/history', [BusinessController::class, 'history']);
        });
    });
});
