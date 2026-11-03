<?php

namespace App\Providers;

use App\Repositories\Contracts\AddressRepository;
use App\Repositories\Contracts\AuditLogRepository;
use App\Repositories\Contracts\ApplicationDocumentRepository;
use App\Repositories\Contracts\AdminRepository;
use App\Repositories\Contracts\AuthTokenRepository;
use App\Repositories\Contracts\BusinessDiscountRepository;
use App\Repositories\Contracts\BusinessReportRepository;
use App\Repositories\Contracts\CustomerFavoriteRepository;
use App\Repositories\Contracts\CustomerCartRepository;
use App\Repositories\Contracts\CustomerNotificationRepository;
use App\Repositories\Contracts\CustomerOrderRepository;
use App\Repositories\Contracts\CustomerReservationRepository;
use App\Repositories\Contracts\PlatformSettingsRepository;
use App\Repositories\Contracts\SupportTicketRepository;
use App\Repositories\Contracts\PsgcLocationRepository;
use App\Repositories\Contracts\RestaurantApplicationRepository;
use App\Repositories\Contracts\RestaurantPageRepository;
use App\Repositories\Contracts\RestaurantDiscoveryRepository;
use App\Repositories\Contracts\RiderApplicationRepository;
use App\Repositories\Contracts\SessionRepository;
use App\Repositories\Contracts\TeamRepository;
use App\Repositories\Contracts\MenuRepository;
use App\Repositories\Contracts\OrderRepository;
use App\Repositories\Contracts\ReservationRepository;
use App\Repositories\Contracts\UserRepository;
use App\Services\Contracts\LocationService;
use App\Repositories\Database\DatabaseAuthTokenRepository;
use App\Repositories\Database\DatabaseAddressRepository;
use App\Repositories\Database\DatabaseBusinessDiscountRepository;
use App\Repositories\Database\DatabaseBusinessReportRepository;
use App\Repositories\Database\DatabaseCustomerFavoriteRepository;
use App\Repositories\Database\DatabaseCustomerCartRepository;
use App\Repositories\Database\DatabaseCustomerNotificationRepository;
use App\Repositories\Database\DatabaseCustomerOrderRepository;
use App\Repositories\Database\DatabaseCustomerReservationRepository;
use App\Repositories\Database\DatabaseApplicationDocumentRepository;
use App\Repositories\Database\DatabaseSupportTicketRepository;
use App\Repositories\Database\DatabaseAuditLogRepository;
use App\Repositories\Database\DatabasePlatformSettingsRepository;
use App\Repositories\Database\DatabasePsgcLocationRepository;
use App\Repositories\Database\DatabaseRestaurantApplicationRepository;
use App\Repositories\Database\DatabaseRestaurantPageRepository;
use App\Repositories\Database\DatabaseRestaurantDiscoveryRepository;
use App\Repositories\Database\DatabaseRiderApplicationRepository;
use App\Repositories\Database\DatabaseSessionRepository;
use App\Repositories\Database\DatabaseTeamRepository;
use App\Repositories\Database\DatabaseMenuRepository;
use App\Repositories\Database\DatabaseOrderRepository;
use App\Repositories\Database\DatabaseReservationRepository;
use App\Repositories\Database\DatabaseUserRepository;
use App\Repositories\Stub\InMemoryAdminRepository;
use App\Services\PsgcLocationService;
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
        $this->app->singleton(RestaurantDiscoveryRepository::class, DatabaseRestaurantDiscoveryRepository::class);
        $this->app->singleton(RiderApplicationRepository::class, DatabaseRiderApplicationRepository::class);
        $this->app->singleton(CustomerFavoriteRepository::class, DatabaseCustomerFavoriteRepository::class);
        $this->app->singleton(CustomerCartRepository::class, DatabaseCustomerCartRepository::class);
        $this->app->singleton(CustomerOrderRepository::class, DatabaseCustomerOrderRepository::class);
        $this->app->singleton(CustomerNotificationRepository::class, DatabaseCustomerNotificationRepository::class);
        $this->app->singleton(CustomerReservationRepository::class, DatabaseCustomerReservationRepository::class);
        $this->app->singleton(SupportTicketRepository::class, DatabaseSupportTicketRepository::class);
        $this->app->singleton(PlatformSettingsRepository::class, DatabasePlatformSettingsRepository::class);
        $this->app->singleton(PsgcLocationRepository::class, DatabasePsgcLocationRepository::class);
        $this->app->singleton(LocationService::class, PsgcLocationService::class);
        $this->app->singleton(SessionRepository::class, DatabaseSessionRepository::class);
        $this->app->singleton(TeamRepository::class, DatabaseTeamRepository::class);
        $this->app->singleton(MenuRepository::class, DatabaseMenuRepository::class);
        $this->app->singleton(OrderRepository::class, DatabaseOrderRepository::class);
        $this->app->singleton(ReservationRepository::class, DatabaseReservationRepository::class);
        $this->app->singleton(BusinessDiscountRepository::class, DatabaseBusinessDiscountRepository::class);
        $this->app->singleton(BusinessReportRepository::class, DatabaseBusinessReportRepository::class);
    }
}
