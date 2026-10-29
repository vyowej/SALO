# SALO Frontend Service to Backend Mapping

**Status:** Phase A mapping; Phase B wires the authentication, customer account, settings, and saved-address flows below when `VITE_USE_MOCK=false`. Other service domains remain mock-backed.

All API routes are under `/api/v1` unless marked as Sanctum/browser-native. Controllers stay thin; authorization, validation, and business rules follow the layering in `FILE_MAP.md`. The browser API adapter uses Sanctum's CSRF cookie and credentialed session cookies.

Admin adapter functions, endpoint paths, payloads, and response shapes are defined by [docs/ADMIN_API_CONTRACT.md](./ADMIN_API_CONTRACT.md); this mapping intentionally does not duplicate that contract.

## Service functions

| Frontend function | Proposed endpoint | Controller | Service/action |
|---|---|---|---|
| `authService.getDemoAccounts()` | No production endpoint; remove/disable outside mock mode | — | Development fixture only |
| `authService.getDemoAccount(email, password)` | No production endpoint | — | Development fixture only |
| `authService.verifyEmailCode(code)` | Mock-only code verification; API mode uses `verifyEmailToken(token)` at `POST /auth/email/verification/verify` | `Auth\EmailVerificationController@verify` | `AuthTokenService` |
| `authService.sendVerificationEmail()` | `POST /auth/email/verification/send` | `Auth\EmailVerificationController@send` | `AuthTokenService` |
| `authService.isEmailRegistered(email)` | No direct enumeration endpoint; API mode defers uniqueness validation to registration | `Auth\RegisteredUserController@store` | `AuthService` |
| `authService.register({ user, address, password })` | `POST /auth/register` | `Auth\RegisteredUserController@store` | `AuthService` (customer capability; address through `AddressRepository`) |
| `authService.login(email, password)` | `POST /auth/login` | `Auth\AuthenticatedSessionController@store` | `AuthService` |
| `authService.logout()` | `POST /auth/logout` | `Auth\AuthenticatedSessionController@destroy` | `AuthService` |
| `authService.requestPasswordReset(email)` / `resetPassword(details)` | `POST /auth/forgot-password` / `POST /auth/reset-password` | `Auth\PasswordResetController` | `AuthTokenService` |
| `authService.updateProfile(updates)` | `PATCH /customer/profile` | `Customer\ProfileController@update` | `AuthService` (allowlisted fields) |
| `authService.deactivateAccount(details)` | `DELETE /customer/profile` | `Customer\ProfileController@destroy` | `AuthService` |
| AuthContext current-account read | `GET /auth/me` | `Auth\CurrentAccountController@show` | `UserResource` (capabilities, memberships, permissions, and driver state) |
| `addressService.getSavedAddresses()` | `GET /customer/addresses` | `Customer\AddressController@index` | `ListCustomerAddresses` |
| `addressService.getSelectedAddress()` | Browser-local selection; saved address list comes from `GET /customer/addresses` | — | Client location selection |
| `addressService.saveAddress(address)` | `POST /customer/addresses`; update existing ID with `PATCH /customer/addresses/{address}`; `PATCH /customer/addresses/{address}/primary` when made primary | `Customer\AddressController` | `AddressService` |
| `addressService.setSelectedAddress(address)` | Browser-local selection; server primary is updated during `saveAddress` | — | Client location selection |
| `locationService.getDefaultMapCenter()` | No endpoint; deployment/provider configuration | — | Frontend map presentation setting [VERIFY] |
| `locationService.getRegions()` | `GET /locations/regions` | `Location\LocationController@regions` | `LocationService` → PSGC provider |
| `locationService.getProvinces(regionCode)` | `GET /locations/regions/{region}/provinces` | `Location\LocationController@provinces` | `LocationService` → PSGC provider |
| `locationService.getCities(provinceCode)` | `GET /locations/provinces/{province}/cities-municipalities` | `Location\LocationController@cities` | `LocationService` → PSGC provider |
| `locationService.getBarangays(cityCode)` | `GET /locations/cities-municipalities/{city}/barangays` | `Location\LocationController@barangays` | `LocationService` → PSGC provider |
| `locationService.searchPlaces(query)` | `GET /locations/places/search?q=...` only for explicit user-submitted search; provider-specific | `Location\LocationController@search` | `LocationService` → approved geocoder [VERIFY] |
| `locationService.reverseGeocode(latitude, longitude)` | `GET /locations/places/reverse?lat=...&lon=...` | `Location\LocationController@reverse` | `LocationService` → approved geocoder [VERIFY] |
| `locationService.getCurrentPosition()` | Browser Geolocation API; no backend endpoint | — | Client permission flow; send coordinates only for an authorized use |
| `locationService.getDistanceKm(from, to)` | `GET /locations/directions?origin=...&destination=...` for road distance; straight-line distance is not a substitute | `Location\DirectionsController@show` | `RoutingService` → OpenRouteService or approved alternative [VERIFY] |
| `locationService.estimateDeliveryFee(distanceKm, restaurant)` | `POST /customer/delivery-quotes` with restaurant/address/service mode; client distance is not trusted | `Customer\DeliveryQuoteController@store` | `QuoteDelivery` using approved fee configuration [VERIFY] |
| `locationService.resolveMockAddress(address)` | No mock resolver endpoint; use normalized PSGC codes and validated address fields | `Location\LocationController@resolve` if approved | `ResolvePhilippineAddress` → PSGC provider |
| `restaurantService.getFeaturedRestaurants({ filipinoOnly })` | No current explicit featured contract; `GET /restaurants?featured=true` only if product rules approve | `Public\RestaurantController@index` or authenticated discovery controller | `ListFeaturedRestaurants` [VERIFY] |
| `restaurantService.getPopularRestaurants()` | `GET /public/restaurants/popular` | `Public\RestaurantController@popular` | `ListPopularRestaurants` |
| `restaurantService.getAllRestaurants()` | `GET /restaurants` (authenticated per brief) | `Customer\RestaurantController@index` | `ListRestaurants` |
| `restaurantService.getCategories()` | `GET /restaurants/categories` (authenticated; categories are derived from approved public catalog) | `Customer\RestaurantCategoryController@index` | `ListRestaurantCategories` |
| `restaurantService.getCustomerHomeContent()` | `GET /customer/home` (authenticated; response composition only) | `Customer\HomeController@show` | `BuildCustomerHome` |
| `restaurantService.getLandingContent()` | No independent guest endpoint; compose from the guest-permitted popular listing plus static client content | `Public\RestaurantController@popular` | `ListPopularRestaurants` |
| `restaurantService.getRestaurantById(id)` | `GET /restaurants/{restaurant}` (authenticated) | `Customer\RestaurantController@show` | `GetRestaurantDetail` |
| `restaurantService.searchRestaurants(query)` | `GET /restaurants?q=...` (authenticated) | `Customer\RestaurantController@index` | `SearchRestaurants` |
| `restaurantService.getOrders()` | `GET /customer/orders` | `Customer\OrderController@index` | `ListCustomerOrders` |
| `restaurantService.getOrderById(id)` | `GET /customer/orders/{order}` for customer view; owner/driver use scoped endpoint | Customer, owner, or driver order controller | `GetAuthorizedOrder` |
| `restaurantService.createOrder(details)` | `POST /customer/checkout-groups` with one order object and `Idempotency-Key` | `Customer\CheckoutController@store` | `PlaceCheckoutGroup` |
| `restaurantService.advanceOrder(id)` | Replace with role-specific `PATCH /owner/restaurants/{restaurant}/orders/{order}/status` or `POST /rider/jobs/{job}/milestones` | `Owner\OrderController@updateStatus` / `Rider\DeliveryJobController@milestone` | `TransitionOrderStatus` |
| `restaurantService.cancelOrder(id, reason)` | `POST /customer/orders/{order}/cancel`; restaurant/admin cancellation uses separate authorized endpoint | `Customer\OrderController@cancel` | `CancelOrder` |
| `restaurantService.getReservations()` | `GET /customer/reservations` | `Customer\ReservationController@index` | `ListCustomerReservations` |
| `restaurantService.createReservation(details)` | `POST /customer/reservations` | `Customer\ReservationController@store` | `CreateReservation` |
| `restaurantService.cancelReservation(id)` | `POST /customer/reservations/{reservation}/cancel` | `Customer\ReservationController@cancel` | `CancelReservation` |
| `restaurantService.getProfile()` | `GET /auth/me` | `Auth\CurrentAccountController@show` | `UserResource` |
| `restaurantService.getSavedAddresses()` | `GET /customer/addresses` | `Customer\AddressController@index` | `ListCustomerAddresses` |
| `restaurantService.getSettings()` / `updateSettings(updates)` | `GET /customer/settings` / `PATCH /customer/settings` | `Customer\SettingsController@show` / `@update` | `AuthService` |
| `ownerService.getOverview(range)` | `GET /owner/restaurants/{restaurant}/dashboard/overview?range=...` | `Owner\DashboardController@show` | `BuildRestaurantDashboard` (requires `analytics.view`) |
| `ownerService.setAcceptingOrders(value)` | `PATCH /owner/restaurants/{restaurant}/accepting-orders` | `Owner\RestaurantController@setAcceptingOrders` | `UpdateRestaurantAvailability` |
| `ownerService.updateOrder(id, action, reason)` | `PATCH /owner/restaurants/{restaurant}/orders/{order}/status` | `Owner\OrderController@updateStatus` | `TransitionOrderStatus` |
| `ownerService.updateReservation(id, status)` | `PATCH /owner/restaurants/{restaurant}/reservations/{reservation}/status` | `Owner\ReservationController@updateStatus` | `TransitionReservationStatus` |
| `ownerService.updateMenuAvailability(id, available)` | `PATCH /owner/restaurants/{restaurant}/menu-items/{item}` with allowed availability field | `Owner\MenuItemController@update` | `UpdateMenuItemAvailability` |
| `ownerService.publishMenuItem(id)` | `PATCH /owner/restaurants/{restaurant}/menu-items/{item}` with active/published state | `Owner\MenuItemController@update` | `PublishMenuItem` |
| `riderService.getOverview(range)` | `GET /rider/dashboard/overview?range=...` | `Rider\DashboardController@show` | `BuildDriverDashboard` |
| `riderService.setOnline(value)` | `PATCH /rider/availability` | `Rider\AvailabilityController@update` | `SetDriverAvailability` |
| `riderService.respondToOffer(id, accepted)` | Replace with `POST /rider/jobs/{job}/claim`; no accept/decline auction | `Rider\DeliveryJobController@claim` | `ClaimDeliveryJob` (atomic first-claim-wins) |

## Current frontend / brief conflicts

1. **Mock/local persistence:** non-account services still use fixtures, `localStorage`, and in-memory mutation. API-mode integration in this phase is limited to authentication, profile, settings, and saved addresses.
2. **Account roles:** API-mode `AuthContext` derives available views from `/auth/me` platform capabilities and memberships; broader role-specific service/API integration remains a later phase.
3. **Email lookup:** API mode does not expose a registration lookup endpoint; it relies on non-enumerating form validation at account creation.
4. **Rider application:** current application is a validated preview and does not submit or persist. Backend onboarding requires an authenticated application submission, private document uploads where needed, and admin review. This requires a later frontend change.
5. **Driver assignment:** current `respondToOffer(id, accepted)` models offers/declines. Brief calls for a job board with atomic first-come-first-served claim and private delivery details revealed only after assignment.
6. **Restaurant membership/team UI:** current owner workspace assumes one owner role and has no restaurant-scoped invitation/member permission flow. Team management and permission-derived navigation are not yet represented.
7. **Order status mutation:** `advanceOrder()` generically advances demo state. Backend must enforce the status machine and distinguish customer, restaurant-member, assigned-driver, and admin actions; arbitrary advance calls are not valid.
8. **Checkout authority:** current cart stores client item prices/quantities locally and derives totals/fees in the browser. The backend must recalculate catalog prices, discounts, fees, availability, and totals; send identifiers/quantities and a checkout idempotency key only.
9. **Location/geocoding:** current providers are mock data and `LocationPicker` triggers debounced search as text changes. Public Nominatim forbids autocomplete and allows at most one request per second per application. Do not wire that UI behavior directly to public Nominatim; use explicit submit or an approved alternative.
10. **Coordinates and delivery quote:** current defaults may fall back to mock coordinates, and distance is straight-line Haversine with a mock fee formula. Do not treat either as authoritative routing, ETA, or fee. The backend needs an approved provider/configuration and server-side quote.
11. **Address storage:** API mode loads and saves owned addresses through the backend, including primary-address updates. The selected delivery address remains browser-local; mock mode retains its localStorage-backed mock address list.
12. **Tracking:** order detail currently uses local/demo state; there is no verified live polling or location-ping integration. Implement only after privacy access, polling/ping interval, cache TTL, and provider limits are approved.
13. **Uploads and sensitive-field reapproval:** current service layer has no upload/document workflow or reapproval status. Business/driver applications and sensitive edits require later UI and API integration.
14. **Maps and routing:** current map view is a frontend presentation component; no production tile/routing provider is wired. Leaflet/OSM tile policy and visible attribution are [VERIFY]; OpenRouteService terms, key/quotas, and fallback are [VERIFY].
15. **Guest access:** backend brief permits guest restaurant discovery only through popular restaurants. Other restaurant listing/search/detail/category/menu/availability endpoints require authentication. Ensure no current guest navigation or client fallback treats mock service results as authorization.

## [VERIFY] before frontend integration

- Exact account fields and sensitive-field reapproval rules.
- Exact restaurant role grants, permission keys, owner transfer/last-owner rules, manager role editing, and invitation expiry.
- Guest feature gate and treatment of the current landing page data sections beyond popular restaurants.
- Whether categories, featured results, home composition, or a guest map preview require additional reviewed endpoints.
- Address selection persistence, geocoder provider, Nominatim non-autocomplete behavior, map tiles, routing/ETA provider and provider limits.
- Checkout fees, discount shape, cash/payment options, cancellation windows, and client/server order status refresh behavior.
- Driver application data/documents, job eligibility/concurrency, location ping and poll cadence, stale-location UI, delivery proof, and tracking stop condition.
- Deployment hostnames, CORS/Sanctum cookie configuration, and whether API responses should use a common `data` envelope at the frontend adapter boundary.
