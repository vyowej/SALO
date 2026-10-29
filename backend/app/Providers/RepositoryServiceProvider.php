<?php

namespace App\Providers;

use App\Repositories\Contracts\AddressRepository;
use App\Repositories\Contracts\AuthTokenRepository;
use App\Repositories\Contracts\UserRepository;
use App\Repositories\Stub\InMemoryAddressRepository;
use App\Repositories\Stub\InMemoryAuthTokenRepository;
use App\Repositories\Stub\InMemoryUserRepository;
use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(UserRepository::class, InMemoryUserRepository::class);
        $this->app->singleton(AddressRepository::class, InMemoryAddressRepository::class);
        $this->app->singleton(AuthTokenRepository::class, InMemoryAuthTokenRepository::class);
    }
}
