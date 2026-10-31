<?php

namespace App\Providers;

use App\Models\Restaurant;
use App\Models\UserAddress;
use App\Models\PsgcLocation;
use App\Policies\PsgcLocationPolicy;
use App\Policies\RestaurantPagePolicy;
use App\Policies\UserAddressPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(PsgcLocation::class, PsgcLocationPolicy::class);
        Gate::policy(Restaurant::class, RestaurantPagePolicy::class);
        Gate::policy(UserAddress::class, UserAddressPolicy::class);

        RateLimiter::for('auth-login', function (Request $request) {
            $email = Str::lower((string) $request->input('email'));

            return Limit::perMinute(max(1, (int) config('salo.auth.login_attempts_per_minute', 5)))
                ->by($email.'|'.$request->ip());
        });

        RateLimiter::for('auth-recovery', function (Request $request) {
            $identity = Str::lower((string) ($request->input('email') ?? $request->user()?->getAuthIdentifier()));

            return Limit::perMinute(max(1, (int) config('salo.auth.recovery_attempts_per_minute', 5)))
                ->by($identity.'|'.$request->ip());
        });

        RateLimiter::for('auth-otp', function (Request $request) {
            $identity = (string) ($request->user()?->getAuthIdentifier() ?? $request->ip());

            return Limit::perMinute(max(1, (int) config('salo.auth.otp_requests_per_minute', 5)))
                ->by($identity.'|'.$request->ip());
        });

        RateLimiter::for('team-email-check', function (Request $request) {
            $ownerId = (string) ($request->user()?->getAuthIdentifier() ?? $request->ip());

            return Limit::perMinute(10)->by($ownerId.'|'.$request->ip());
        });

        RateLimiter::for('team-invitation-activation', function (Request $request) {
            $token = (string) $request->route('token');

            return Limit::perMinute(5)->by(hash('sha256', $token).'|'.$request->ip());
        });
    }
}
