# SALO Backend File Map

**Status:** Phase A architecture, Phase B Laravel account implementation, and in-memory admin API. No database schema, migration, seeder, factory, or SQL is included.

Admin endpoint paths, resource shapes, fixture requirements, and behavior are governed by [ADMIN_API_CONTRACT.md](./ADMIN_API_CONTRACT.md); keep this architecture map focused on implementation structure.

## Planned tree

```text
backend/
├── app/
│   ├── Actions/
│   │   ├── Applications/
│   │   │   ├── SubmitRestaurantApplication.php
│   │   │   └── SubmitRiderApplication.php
│   │   ├── Checkout/
│   │   │   ├── PlaceCheckoutGroup.php
│   │   │   └── CancelOrder.php
│   │   ├── Reservations/
│   │   │   ├── CreateReservation.php
│   │   │   ├── ConfirmReservation.php
│   │   │   └── CancelReservation.php
│   │   ├── Orders/
│   │   │   └── TransitionOrderStatus.php
│   │   ├── Discounts/
│   │   │   └── QuoteDiscount.php
│   │   └── Admin/
│   │       ├── ReviewRestaurantApplication.php
│   │       └── ReviewRiderApplication.php
│   ├── Console/
│   │   └── Commands/
│   │       ├── ExpireReservationHolds.php
│   │       ├── ExpireCarts.php
│   │       └── ResetDailyMenuQuantities.php
│   ├── Enums/
│   │   ├── PlatformCapability.php
│   │   ├── RestaurantRole.php
│   │   ├── DiscountType.php
│   │   ├── OrderStatus.php
│   │   ├── ReservationStatus.php
│   │   ├── RestaurantStatus.php
│   │   └── ServiceMode.php
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   ├── Admin/
│   │   │   ├── Auth/
│   │   │   │   ├── PasswordResetController.php
│   │   │   │   └── EmailVerificationController.php
│   │   │   ├── Customer/
│   │   │   │   └── SettingsController.php
│   │   │   ├── Location/
│   │   │   ├── Owner/
│   │   │   ├── Public/
│   │   │   ├── Rider/
│   │   │   ├── Team/
│   │   │   └── Upload/
│   │   ├── Middleware/
│   │   │   ├── EnsurePlatformCapability.php
│   │   │   ├── EnsureMembershipPermission.php
│   │   │   ├── ForceJson.php
│   │   │   └── IdempotencyKey.php
│   │   ├── Authorization/
│   │   │   └── PermissionMap.php
│   │   ├── Requests/
│   │   │   ├── Auth/
│   │   │   │   ├── ForgotPasswordRequest.php
│   │   │   │   ├── ResetPasswordRequest.php
│   │   │   │   └── VerifyEmailRequest.php
│   │   │   ├── Customer/
│   │   │   │   └── UpdateSettingsRequest.php
│   │   │   ├── Owner/
│   │   │   ├── Rider/
│   │   │   ├── Admin/
│   │   │   ├── Location/
│   │   │   ├── Team/
│   │   │   └── Upload/
│   │   └── Resources/
│   │       ├── UserResource.php
│   │       ├── SettingsResource.php
│   │       ├── RestaurantResource.php
│   │       ├── MenuCategoryResource.php
│   │       ├── MenuItemResource.php
│   │       ├── AddressResource.php
│   │       ├── CartResource.php
│   │       ├── CheckoutGroupResource.php
│   │       ├── OrderResource.php
│   │       ├── ReservationResource.php
│   │       ├── ApplicationResource.php
│   │       ├── DiscountResource.php
│   │       ├── MembershipResource.php
│   │       ├── DeliveryJobResource.php
│   │       ├── DriverLocationResource.php
│   │       ├── UploadResource.php
│   │       └── LocationResource.php
│   ├── Models/
│   │   ├── User.php
│   │   ├── Restaurant.php
│   │   ├── RestaurantMembership.php
│   │   ├── TeamInvitation.php
│   │   ├── RestaurantApplication.php
│   │   ├── RiderApplication.php
│   │   ├── MenuCategory.php
│   │   ├── MenuItem.php
│   │   ├── Address.php
│   │   ├── Cart.php
│   │   ├── CheckoutGroup.php
│   │   ├── Order.php
│   │   ├── OrderItem.php
│   │   ├── DeliveryJob.php
│   │   ├── Reservation.php
│   │   ├── RestaurantTable.php
│   │   ├── Discount.php
│   │   └── Upload.php
│   ├── Notifications/
│   │   ├── PasswordResetNotification.php
│   │   └── EmailVerificationNotification.php
│   ├── Policies/
│   │   ├── RestaurantPolicy.php
│   │   ├── OrderPolicy.php
│   │   ├── ReservationPolicy.php
│   │   ├── MenuItemPolicy.php
│   │   ├── DiscountPolicy.php
│   │   ├── MembershipPolicy.php
│   │   └── DeliveryJobPolicy.php
│   ├── Providers/
│   │   └── RepositoryServiceProvider.php
│   ├── Repositories/
│   │   ├── Contracts/
│   │   │   ├── UserRepository.php
│   │   │   ├── AuthTokenRepository.php
│   │   │   ├── MembershipRepository.php
│   │   │   ├── InvitationRepository.php
│   │   │   ├── RestaurantRepository.php
│   │   │   ├── ApplicationRepository.php
│   │   │   ├── MenuRepository.php
│   │   │   ├── CartRepository.php
│   │   │   ├── CheckoutRepository.php
│   │   │   ├── OrderRepository.php
│   │   │   ├── ReservationRepository.php
│   │   │   ├── DiscountRepository.php
│   │   │   ├── AddressRepository.php
│   │   │   ├── DeliveryJobRepository.php
│   │   │   ├── UploadRepository.php
│   │   │   ├── DriverLocationCache.php
│   │   │   ├── AdminAuditRepository.php
│   │   │   └── LocationProvider.php
│   │   └── Stub/
│   │       ├── InMemoryUserRepository.php
│   │       ├── InMemoryAuthTokenRepository.php
│   │       ├── InMemoryMembershipRepository.php
│   │       ├── InMemoryInvitationRepository.php
│   │       ├── InMemoryRestaurantRepository.php
│   │       ├── InMemoryApplicationRepository.php
│   │       ├── InMemoryMenuRepository.php
│   │       ├── InMemoryCartRepository.php
│   │       ├── InMemoryCheckoutRepository.php
│   │       ├── InMemoryOrderRepository.php
│   │       ├── InMemoryReservationRepository.php
│   │       ├── InMemoryDiscountRepository.php
│   │       ├── InMemoryAddressRepository.php
│   │       ├── InMemoryDeliveryJobRepository.php
│   │       ├── InMemoryUploadRepository.php
│   │       ├── InMemoryDriverLocationCache.php
│   │       ├── InMemoryAdminAuditRepository.php
│   │       ├── CachedPsgcLocationProvider.php
│   │       └── NominatimLocationProvider.php
│   └── Services/
│       ├── AuthService.php
│       ├── AuthTokenService.php
│       ├── AddressService.php
│       ├── PermissionService.php
│       ├── TeamInvitationService.php
│       ├── DeliveryJobService.php
│       ├── DriverTrackingService.php
│       ├── UploadService.php
│       ├── RoutingService.php
│       ├── OrderService.php
│       ├── CheckoutGroupService.php
│       ├── ReservationService.php
│       ├── DiscountService.php
│       ├── RestaurantApprovalService.php
│       ├── LocationService.php
│       └── OpeningHoursService.php
├── config/
│   ├── cors.php
│   ├── sanctum.php
│   ├── salo.php
│   └── services.php
├── routes/
│   └── api.php
├── tests/
│   ├── Feature/
│   │   ├── AuthAndCustomerAccountTest.php
│   │   ├── Api/V1/
│   │   ├── Auth/
│   │   ├── Checkout/
│   │   ├── Orders/
│   │   ├── Reservations/
│   │   ├── Discounts/
│   │   ├── Applications/
│   │   ├── Locations/
│   │   └── Authorization/
│   └── Unit/
│       ├── Services/
│       └── Actions/
└── composer.json
```

## Request-to-response flow

```text
routes/api.php
  → ForceJson + Sanctum authentication + platform capability or restaurant membership-permission gate + IdempotencyKey (when applicable)
  → FormRequest validation/authorization
  → thin Api/V1 controller
  → Action for a state-changing business workflow
  → Service for reusable rules/calculation
  → Repository contract
  → temporary in-memory Stub implementation
  → API Resource / normalized error envelope
```

Controllers only translate validated input to a service/action call and return a resource. Routes only declare URL, middleware, controller, and name. Business rules, ownership, totals, transitions, scheduling rules, and provider normalization do not live in controllers or routes.

## Responsibility and boundaries

| Area | Owns | Must not own |
|---|---|---|
| `routes/api.php` | Version prefix, middleware groups, endpoint declarations by permission/capability | Validation, rules, database access, response construction |
| `Http/Middleware` | JSON enforcement, platform-capability or membership-permission gate, idempotency header shape | Resource ownership decisions or business transitions |
| `Http/Authorization/PermissionMap.php` | Central restaurant role-to-permission grants used by `/auth/me`, middleware, policies, and invitation validation | Per-request data access or frontend-only visibility decisions |
| `Http/Requests` | Input shape, field constraints, request-level authorization hook | Persistent changes or business calculations |
| Controllers | Call action/service with validated data; return Resource/status | Business rules, raw repository calls, raw queries |
| `Actions` | Orchestration and atomic use cases (multi-order checkout, reservation lock/check/create, status decisions) | HTTP concerns or SQL |
| `Services` | Reusable business rules (opening hours, prices/discounts, order/reservation lifecycle, location normalization) | Request parsing or route authorization |
| `Repositories/Contracts` | Data access interfaces and transaction/locking capabilities required by rules | Framework request/response |
| `Repositories/Stub` | Temporary in-memory implementation of repository/provider contracts for development and tests | Claims of durable storage or production readiness |
| `Policies` | Membership/resource relationship checks, customer ownership, admin audits, and driver assignment scope | Data lookup as raw query or business state transitions |
| `Models` | Relationships, casts, `$fillable` only as specified | Business workflows or migrations/schema invention |
| `Http/Resources` | Stable, privacy-safe API representations and envelope data | Business calculations |
| `Console` | Idempotent scheduled commands delegating into services/actions | Direct query logic or deleting historical records |
| `tests` | Feature tests of API rules/authorization and unit tests against stub contracts | Reliance on an unapproved database schema |

## Database boundary and required marker

- Every behavior requiring persistence goes through a repository contract.
- Each temporary in-memory stand-in and each persistence-dependent call site must be visibly marked `// DB-INTEGRATION:` in implementation, describing the contract operation and the future database concern (for example uniqueness, transaction, row lock, or durable idempotency).
- Repository bindings are centralized in `RepositoryServiceProvider.php`; contract-to-stub mappings are explicit.
- Stub behavior is deterministic for tests and explicitly non-durable. It must not pretend to guarantee cross-process idempotency, database transaction atomicity, row-level locking, or persistent scheduling.
- No migration, seeder, factory, SQL, schema declaration, or production database adapter is created until the user supplies/approves the database design.

## Tests and implementation coverage map

| Rule group | Expected feature/unit coverage |
|---|---|
| Auth/capabilities | Default customer registration; login/logout/reset; deactivated and suspended login rejection; rate limiting; one account with multiple capabilities/memberships; `/auth/me` permission shape |
| Discovery/approval | Only popular endpoint is public; pending/rejected/suspended restaurant hidden; approved restaurant visible |
| Isolation | Member cannot access a restaurant without active membership and permission; customer cannot read another user's orders/reservations/addresses; driver cannot read another driver's job/location |
| Opening hours/menu | Asia/Manila schedule; overnight hours; 24/7 skip; service-mode compatibility; active vs availability distinction; price > 0 |
| Checkout | Single-restaurant and multi-store groups; reject one invalid store with no partial orders; correct server totals/discount; exact replay vs changed-payload idempotency |
| Order lifecycle | Allowed transitions by permission-bearing restaurant member/driver/customer/admin; pending-only customer cancellation; required cancellation reason; terminal statuses |
| Discounts | Inactive/out-of-window/below-minimum/limit-reached; percentage/fixed/cap; funding source; no usage consumed on failed group |
| Reservations | Capacity/maintenance/hours/24-7; overlap conflict; table lock-before-overlap repository operation; two-hour cancellation boundary; status transitions |
| Deactivation | Soft-delete behavior, session invalidation, new activity block, retained history |
| Location | PSGC path mapping, Nominatim normalization/country restriction, caching, timeout/fallback, attribution and no-autocomplete design |
| Team and privacy | Single-use invitation lifecycle; matching-email acceptance; permission revocation; no role escalation; private application uploads |
| Delivery/tracking | Atomic first-claim-wins; no PII on job board; assigned-only details; milestone transition guards; short-TTL last location; no location history |
| Schedulers | Expiry idempotency, timezone/date boundaries, daily quantity reset, historical record preservation |

See [API_CONTRACT.md](./API_CONTRACT.md) for the endpoint registry, [PROCESS_FLOWS.md](./PROCESS_FLOWS.md) for rule sequences and assumptions, [ROLE_PERMISSION_MATRIX.md](./ROLE_PERMISSION_MATRIX.md) for authorization grants, [DATA_REQUIREMENTS.md](./DATA_REQUIREMENTS.md) for repository data needs, [PRIVACY_AND_SECURITY.md](./PRIVACY_AND_SECURITY.md) for privacy/security controls, and [FRONTEND_API_MAPPING.md](./FRONTEND_API_MAPPING.md) for frontend service alignment and conflicts.
