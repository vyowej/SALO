<?php

namespace App\Providers;

use App\Repositories\Contracts\AddressRepository;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\ApplicationDocumentRepository;
use App\Repositories\Contracts\AdminRepository;
use App\Repositories\Contracts\AuthTokenRepository;
use App\Repositories\Contracts\BusinessDiscountRepository;
use App\Repositories\Contracts\BusinessReportRepository;
use App\Repositories\Contracts\PlatformSettingsRepository;
use App\Repositories\Contracts\PsgcLocationRepository;
use App\Repositories\Contracts\RestaurantApplicationRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use App\Repositories\Contracts\SessionRepository;
use App\Repositories\Contracts\TeamRepository;
use App\Repositories\Contracts\MenuRepository;
use App\Repositories\Contracts\OrderRepository;
use App\Repositories\Contracts\ReservationRepository;
use App\Repositories\Contracts\UserRepository;
use App\Repositories\Database\DatabaseAuthTokenRepository;
use App\Repositories\Database\DatabaseAddressRepository;
use App\Repositories\Database\DatabaseBusinessDiscountRepository;
use App\Repositories\Database\DatabaseBusinessReportRepository;
use App\Repositories\Database\DatabaseApplicationDocumentRepository;
use App\Repositories\Database\DatabaseAuditLogRepository;
use App\Repositories\Database\DatabasePlatformSettingsRepository;
use App\Repositories\Database\DatabasePsgcLocationRepository;
use App\Repositories\Database\DatabaseRestaurantApplicationRepository;
use App\Repositories\Database\DatabaseRestaurantPageRepository;
use App\Repositories\Database\DatabaseSessionRepository;
use App\Repositories\Database\DatabaseTeamRepository;
use App\Repositories\Database\DatabaseMenuRepository;
use App\Repositories\Database\DatabaseOrderRepository;
use App\Repositories\Database\DatabaseReservationRepository;
use App\Repositories\Database\DatabaseUserRepository;
use App\Repositories\Stub\InMemoryAdminRepository;
use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(UserRepository::class, DatabaseUserRepository::class);
        $this->app->singleton(AdminRepository::class, InMemoryAdminRepository::class);
        $this->app->singleton(AddressRepository::class, DatabaseAddressRepository::class);
        $this->app->singleton(AuthTokenRepository::class, DatabaseAuthTokenRepository::class);
        $this->app->singleton(ApplicationDocumentRepository::class, DatabaseApplicationDocumentRepository::class);
        $this->app->singleton(AuditLogRepository::class, DatabaseAuditLogRepository::class);
        $this->app->singleton(RestaurantApplicationRepository::class, DatabaseRestaurantApplicationRepository::class);
        $this->app->singleton(RestaurantPageRepository::class, DatabaseRestaurantPageRepository::class);
        $this->app->singleton(PlatformSettingsRepository::class, DatabasePlatformSettingsRepository::class);
        $this->app->singleton(PsgcLocationRepository::class, DatabasePsgcLocationRepository::class);
        $this->app->singleton(SessionRepository::class, DatabaseSessionRepository::class);
        $this->app->singleton(TeamRepository::class, DatabaseTeamRepository::class);
        $this->app->singleton(MenuRepository::class, DatabaseMenuRepository::class);
        $this->app->singleton(OrderRepository::class, DatabaseOrderRepository::class);
        $this->app->singleton(ReservationRepository::class, DatabaseReservationRepository::class);
        $this->app->singleton(BusinessDiscountRepository::class, DatabaseBusinessDiscountRepository::class);
        $this->app->singleton(BusinessReportRepository::class, DatabaseBusinessReportRepository::class);
    }
}
