# SALO Customer Side

**Status:** C0 audit and contract only. [DATABASE_SCHEMA_V3.sql](./DATABASE_SCHEMA_V3.sql) is the authoritative physical schema and overrides [SALO_PLAN_v2.md](./SALO_PLAN_v2.md), this document, and unapplied migration/model code wherever they differ. The owner will edit v3; no database exists and no migration has been applied. Do not execute v3 because it begins with DROP/CREATE DATABASE statements. This document describes Customer behavior using v3 where possible and marks unsupported behavior [VERIFY]; it does not authorize code, migration, or database changes.

## 1. C0 prerequisite and implementation audit

There is no database; no migrations have been applied. The files in `backend/database/migrations` are unrun source and do not establish that tables exist. The supplied v3 SQL is the intended physical design only. Nothing in this audit assumes that any table exists at runtime. PHP 8.0.30 is also below the installed Composer requirement (>= 8.4.1), so backend runtime tests could not establish database behavior.

| Prerequisite | What exists | C0 assessment |
|---|---|---|
| Login, registration, password reset, email verification | Laravel auth controllers/services, hashed auth tokens, session middleware, OTP verification endpoints and tests | Exists. Email delivery configuration and production OTP delivery still need environment verification. |
| Modes, capabilities, `/auth/me` | Session-backed active mode and selected restaurant; `/api/v1/auth/me`; capability middleware | Exists. Backend gates remain authoritative. |
| PermissionMap | `PermissionMap` derives permissions from restaurant roles | Exists for Business; Customer-specific object policies for orders, addresses, reviews, and reservations are not yet present. |
| PSGC hierarchy | `psgc_locations` migration, importer, repository, public level/parent endpoint | Code exists; official PSGC data import is not verified. The current endpoint searches only within one requested level/parent, not one cross-level `Zamboanga` query with a full hierarchy. |
| Public/private local storage | Local public and private disks, public-photo and private-document storage services | Exists for Business/application uploads. Customer location provider, reverse-geocoding, street autocomplete, and route/ETA provider adapters do not exist. |
| Platform settings | `platform_settings` migration proposal and database repository | Repository/service source exists; no table exists in a live database. Customer fee/radius/ETA setting keys and seeded values are not established. |
| Business restaurant/menu/hours/tables/discounts | Business services plus intended migration files for restaurant, menu, hours, tables, reservation settings, discounts and redemptions | Business-side code exists. These migrations are unapplied; none of those tables exists in a live database. `ReservationAvailabilityService` validates availability and creates reservations internally, but is not a public customer booking API and does not yet enforce Customer email verification or the three-active-reservation cap. |
| Customer account/profile | Authenticated `GET/PATCH /api/v1/customer/profile`, `DELETE /profile`, and `GET/PATCH /settings` | Endpoints exist. Customer authorization relies on `auth:sanctum` plus `capability:customer`; no dedicated Customer policy is wired. Profile currently edits a combined `name` and `phone`; avatar URL is always null. Settings are held in the session, not persisted in the database. Deactivation checks password but does not persist the optional reason or implement retention/anonymization. |
| Customer saved addresses | Address routes, FormRequests, Resource and `AddressService` exist; v3 defines `user_addresses` | **Not persistent:** `AddressRepository` is bound to `InMemoryAddressRepository`, session-backed; no UserAddress model or migration exists. The current API uses text fields and `is_main`. V3's `psgc_code` and coordinates are nullable; `address_type` omits School and the `(user_id,is_default)` index is not unique. Enforce delivery completeness, Philippines coordinates, and one default in the service; use `address_type=other` and `label=School` for School unless the owner later changes v3. |
| Customer browsing and restaurant pages | React routes/pages and mock restaurant/menu data exist | Mock-only: `restaurantService` returns local fixtures for browse/search/detail; no public restaurant/menu API is registered. |
| Cart and checkout | React cart/checkout pages and cart context exist | Mock/local-storage only. Totals and discounts are presently calculated in the frontend. The backend has no cart, pricing quote, group checkout, or checkout endpoint. |
| Orders and tracking | v3 defines checkout/order/payment/history/delivery/review tables; Business order API/service exists in source | Customer order API is absent. Delivery, rider assignment, live location cache endpoint, route/ETA, receipt-confirmation endpoint, and customer notification flow are not implemented. |
| Customer reservations | Customer reservation pages and mock service exist; Business tables/settings/reservation services are implemented | Customer list/create/cancel/availability endpoints are absent. Business reservation service is reusable, but current customer pages are mock-backed. |
| Favorites, ratings and help | v3 defines favorites, restaurant/rider reviews, support tickets/messages, and notifications | Customer API/models are missing; v3 has corresponding intended tables. `ticket_messages.user_id` represents the sender; Admin authority must be checked through the user's platform-admin capability. |
| Scheduler support | `routes/console.php` schedules team invite expiry, audit pruning, quantity reset, unanswered Business order cancellation and pending reservation expiry | Scheduler definitions exist in source, but require a configured database/cache and worker/runtime to operate. Customer cart expiry and Delivered-order auto-confirm jobs are missing. |

### Migration source inventory and Plan v2 differences

Migration files present are:

- `000001_create_foundation_tables.php`
- `000002_create_restaurant_access_and_applications.php`
- `000003_create_restaurant_page_tables.php`
- `000005_create_invitations.php`
- `000006_create_menu_tables.php`
- `000007_create_shared_order_tables.php`
- `000008_create_restaurant_reservation_tables.php`
- `000009_create_discount_tables.php`

`000004` is absent; the sequence jumps from 003 to 005. The Customer-specific tables below are absent from this intended migration set. The shared order, reservation and discount migration files are schema proposals only; none have been applied and none of their tables exist in a live database.

The authoritative v3 schema differs from the Laravel migration/model source. V3 has a single required `restaurants.owner_user_id` and no Owner role in `restaurant_staff`; it therefore cannot yet represent the agreed several-Owners-per-restaurant rule. The owner will update v3. Owner transfers and Manager ownership-change requests are not part of the approved workflow; an Owner may add another Owner after the schema supports it. Do not treat legacy code as the final ownership implementation.

The following comparisons concern intended schema source only; none are live tables:

1. V3 defines `user_addresses`, with nullable `psgc_code`, `street`, coordinates and `is_default`; `(user_id,is_default)` is non-unique. Preserve v3. Enforce delivery completeness and exactly one default in a transaction. Use `address_type=other` plus `label=School` for School; no schema change is made here.
2. V3 already has nullable `orders.delivery_address_id` and immutable address text/coordinate snapshots, plus recipient name/phone. Use these fields; do not add another address snapshot table.
3. V3 already has carts, cart items, checkout groups, orders, favorites, reviews, support tickets/messages, notifications and discount redemptions. Use the existing names and keys; do not add parallel Customer tables.
4. V3 represents first-order discount as a `discounts.type` value, not `first_order_only`. Align Business/Customer contracts to the v3 type; do not retain the old flag.
5. Current address API fields (`is_main`, `rider_note`, free-text hierarchy) are temporary. Map to v3's `is_default`, `delivery_note`, `psgc_code`, `address_type`, `label` and `custom_label`; keep any legacy response adaptation explicit during migration.
6. V3 separates restaurant approval in `restaurant_applications` from a restaurant's operational `status` and `is_published`. Public browse remains Approved + Published; no new application status is added to `restaurants`.
7. V3 includes support-ticket tables; Admin assignment/sender access is by `users` plus `platform_admins`, not a separate Admin sender table.
8. V3 has no avatar or durable onboarding-preference columns. Do not add them in Customer work: omit avatar upload/persisted onboarding completion; welcome completion may remain session/browser state.
9. V3 has no reservation reschedule-request row/state. Do not create a new table; a Customer approval-request workflow is [VERIFY] and must remain disabled. Customer can cancel and rebook in the meantime.
10. V3 has no cart status; unique `(user_id,restaurant_id)` means one reusable cart row per pair. Derive active/expired from `expires_at` and contents, and reuse/clear it rather than creating cart lifecycles.
11. V3's `payments.order_id` is not unique; payment attempts are one-to-many per order. Do not impose Plan v2's 1:1 assumption.
12. V3 stores user profile settings only where columns exist; the existing Customer settings endpoint is session-backed. No additional settings/avatar/onboarding columns are requested by this contract.

### Plan components that depend on a database

The following work requires a database schema and an available database connection; code or mock behavior alone is not production persistence. V3 is the intended physical design, but its tables are not live until the owner approves and applies an implementation migration.

- **C0/Foundation:** persist users, auth tokens, sessions, capabilities/memberships, PSGC hierarchy, platform settings, notifications and audit events. Auth/mode controller source exists, but database-backed operation cannot be verified or used until these tables exist.
- **C1:** use v3 user fields and persist saved addresses; enforce one default per user in a service transaction because the v3 index is not unique; validate PSGC/coordinate fields and delivery completeness. Do not add avatar/onboarding columns; settings remain session-backed unless represented in v3.
- **C2:** query approved/published restaurants, menus, cuisines, hours, closures and reviews; server-side search/filter/order/pagination; persist `favorite_restaurants`, `favorite_menu_items`, and ratings.
- **C3:** persist/reuse the one `carts` row per user/restaurant and its `cart_items`; expire using `expires_at`; lock inventory; calculate prices/fees/discounts from authoritative records; enforce code limits; create `checkout_groups`, orders, items, payments, status history and redemption atomically with idempotency. V3 permits multiple payment rows per order.
- **C4:** enforce customer ownership of orders, store status history/payment/receipt confirmation and reviews/support tickets; perform stock/redemption release in transactions. Rider/delivery records and live location also depend on Phase 4 schema/cache services.
- **C5:** query tables, hours, closures and reservation settings; lock the table and recheck overlap transactionally; enforce customer reservation limits and cancellation rules. Customer reschedule approval requests are [VERIFY] and disabled because v3 has no request state/table; cancel and rebook meanwhile.
- **C6:** use v3 support-ticket/message and notification tables; Admin sender/assignee capability is checked via `platform_admins`. Retain order/reservation history and apply approved retention rules. No avatar/onboarding/settings columns are added.
- **Schedulers and integration:** cart expiration, receipt auto-confirmation and existing Business jobs need operational database/cache drivers, scheduler execution and (where used) queue workers. Live routing/geocoding provider calls additionally need backend configuration, but do not by themselves require new application tables unless caching/state is persisted.

Until a database is created and owner-approved implementation migrations are applied, all Customer persistence and any database-backed claim remain unverified. V3 is the physical schema source; the owner will make any schema edits. Do not create or run a migration, create/change a database, or edit v3 as part of Customer documentation or implementation work without separate owner approval.

## 2. Customer page and flow inventory

| Flow | Current UI | Current behavior / required work |
|---|---|---|
| Home and first-use guidance | `/` and CustomerHome | Mock data; first-login three-step welcome and next-best-action flow incomplete. |
| Browse, search, restaurant and menu | `/restaurants`, `/restaurants/:id` | Mock fixtures and client filtering; server-side approved/published filtering, pagination, authoritative availability and public APIs required. |
| Location and addresses | Profile address form, header location controls, location picker | Saved-address API is session-memory only; PSGC hierarchical endpoint exists. Cross-level search, actual geolocation reverse lookup, pin validation, and provider-backed suggestions are missing. |
| Cart and checkout | `/cart`, `/checkout` | Browser storage/mock calculations; must become authenticated backend carts and server-quoted atomic multi-restaurant checkout. |
| Orders and tracking | `/orders`, `/orders/:id` | Mock order records and simulation. Backend customer ownership endpoints and driver/tracking records are missing. |
| Reservations | `/reservations`, `/reservations/new`, `/reserve` | Mock Customer reservation data. Business availability service exists; authenticated Customer endpoints are missing. |
| Profile and settings | `/profile`, `/settings` | Profile/settings APIs exist; address durability, email-change OTP, password/session revocation contract and sensitive confirmations need verification/completion. |
| Favorites | No dedicated route found | Missing. |
| Receipt confirmation, rating, help and notifications | No Customer route/API found | Missing. |
| Partner/rider links | `/partner/apply`, `/rider/apply` | Application entry points exist; Customer-mode gating/status integration must be checked. Rider application backend is outside Customer C0. |

### Customer flow acceptance requirements

These are the behavior gates for the later Customer slices; C0 documents them but does not implement them.

- **C1 — account and location:** On first login, show a skippable three-step welcome (set a delivery location, explore popular restaurants, try a reservation) and a home screen with the next best action; persist no completion flag absent from v3. V3 address fields are `address_type` (`home`, `work`, `church`, `other`), `label`, `custom_label`, `psgc_code`, `street`, `house_no`, coordinates, `delivery_note`, and `is_default`. Encode School as `address_type=other` and `label=School`. Enforce one default in a locked service transaction (the index is non-unique). PSGC, street and coordinates may be null in v3; require valid location/coordinates for delivery quote/checkout, not for an incomplete saved address. GPS requires localhost/HTTPS, exposes accuracy, and allows dragging the pin. Denial, unavailable GPS, timeout, or provider failure must have a manual fallback. Manual search is type-ahead, not a dropdown: debounce fuzzy search across PSGC levels and display the full location hierarchy; "Zamboanga" must include the city, both provinces, and Sibugay. Street/landmark autocomplete is Philippines-only through the backend. Reject pins outside the Philippines. Pages call only the shared swappable `locationService`; provider keys never enter React or `VITE_` variables.
- **C2 — browse and favorites:** Home shows popular restaurants, categories, distance-sorted nearby options, Open 24/7/Open now, Delivery/Pick-up, and Walk-in welcome badges. Restaurant search spans name, cuisine and dish; filters include cuisine, Filipino-only, dietary tags, Open 24/7, open now, Delivery/Pick-up and rating; sort by nearest, rating or popularity; pagination is server-side. Only Approved + Published restaurants appear. Restaurant details show cover/logo/gallery, hours, dietary badges, reviews and searchable category menu. Sold-out items remain visible but disabled; Draft/Archived are not exposed. The item detail modal supports add-ons, note and quantity through a portal with correct stacking and mobile bottom-sheet behavior. Show Reserve table when enabled and Get directions. Favorites cover restaurants and menu items and have an empty state. Guests can see only popular restaurants; gated interactions show the preview/gate rather than private or non-popular data. `/reserve` is the guest-facing reservation promotion.
- **C3 — cart and checkout:** V3 has one reusable cart row per user/restaurant, not cart lifecycle records. Multiple restaurants can coexist and group on the cart page. Quantity, note and remove actions update server-backed `cart_items`; touch the parent cart's `updated_at` on every item mutation, set `expires_at` seven days later while nonempty, and clear items plus `expires_at` after expiry or checkout. Carts do not reserve stock. One checkout view has a section per restaurant and a derived grand total. Each section selects Delivery/Pick-up, its own address (default preselected; one address per order), delivery fee, discount, payment method and itemized subtotal/total. Pickup shows restaurant location/directions instead of an address and has no delivery fee. Delivery requires an in-radius pin; before a pin, show "Set your delivery location to see the fee" and block place-order. Quote displays route distance/fee and ETA as a range and clock time: remaining prep + rider-to-restaurant travel + handoff buffer + rider-to-customer travel. If routing is down, use a straight-line estimate and label it. Fees/radius come from platform settings; starting values in Plan v2 are proposed only (base ₱35 through 2 km, ₱10 per additional km, 10 km maximum radius, 5% service fee, 20-minute prep, 3-minute handoff, 20 km/h, 1.3 detour, 80% rider share and 15% commission).
- Discount evaluation is ordered: scope/code exists; active; dates; minimum; total and per-customer limits (null per-customer limit means no cap); first-order eligibility [VERIFY]; then percentage/cap, fixed/eligible subtotal cap, or free-delivery calculation. Show the plan's friendly reason (invalid for this order, unavailable, expired/not started, fully claimed, already used, or amount still needed). Restaurant-funded codes apply only to that restaurant's order. A platform code applies to one chosen order in the group, defaulting to the largest. Revalidate inside the transaction. Only COD for delivery and pay-at-pick-up are selectable; online banks/GCash remain disabled "Coming soon". Backend ignores frontend totals. Before writing, validate every restaurant/order; any failure creates nothing and identifies the failing restaurant/item. A successful transaction creates the CheckoutGroup, all orders/items/snapshots/history/payments/redemptions and stock changes atomically. Idempotency prevents double-click duplicates. Confirmation shows a reference for each order with a brief celebration. Remove obsolete "one restaurant per checkout" copy.
- **C4 — orders and tracking:** Order list separates current/past and supports filters. Details include receipt, item/price snapshots, address, payment and timeline. Delivery steps are Placed, Confirmed, Preparing, Ready, Out for Delivery, Delivered and Completed; pickup omits delivery-only steps; Cancelled, Rejected and Delivery Failed are terminal branches. Every step has done/current/upcoming state, icon, label and timestamp. Delivery map shows restaurant, customer pin, rider when assigned, route, distance and ETA; rider card includes name/photo/vehicle/call action. A location older than two minutes shows a stale-location notice. Poll at 5–10 seconds, pause for hidden tabs and back off on failures. Pickup shows restaurant location/directions. Until Driver is built, local mode may simulate rider progress; production must show "Looking for a rider" rather than inventing assignment.
- Customer cancellation is allowed only while Placed, after confirmation, with optional reason; stock/redemption release is atomic. When Delivered, ask whether the order arrived. Yes completes and opens restaurant (1–5 plus optional comment) and rider rating if assigned; No creates a support ticket for Admin review. Auto-confirm unanswered receipt after the configured 24 hours while leaving rating available. One review per order per target; owners/staff cannot review their own restaurant. Restaurant reviews appear publicly and Business may reply. Poll status and provide in-app/email notifications for key events; use Laravel Mail/Mailtrap in development.
- **C5 — reservations:** Customer selects a public restaurant accepting reservations, date/time/guest count, then only free slots returned by shared availability logic. Never show another customer's booking. Recheck under transaction/row lock; only one concurrent request wins, and losers see a just-taken message and alternatives. Enforce Active table, capacity, hours/24/7, closure, booking window, slot rules, verified email and at most three active reservations. Confirmation is Pending or Confirmed by restaurant policy; pending holds expire after the configured review window. Reservation history separates upcoming/past and shows v3 statuses. Cancel to cutoff; late-cancellation status is not a v3 field, so keep that marker out of the API unless represented by an approved existing field. Customer reschedule approval requests are [VERIFY] and disabled; cancel and rebook meanwhile.
- **C6 — settings and help:** Allow name, email, mobile, password and addresses; do not offer persisted avatar upload because v3 has no avatar path. Email changes require fresh OTP; password changes require current password and revoke other sessions; account deactivation requires password, consequence disclosure, confirmation, soft deactivation and retained order/reservation history. Sensitive changes have an explicit confirmation. Partner and rider links show application status and open their existing/future wizards from Customer mode; Business mode is prompted to switch before ordering or rider application. Support tickets allow customer messages/replies; notifications show read/unread state. Settings preferences remain session-backed; do not persist fields absent from v3.
- **All Customer UI:** use design tokens and shared components; one primary orange action per view, outlined secondary actions, forest green never as primary fill, solid surfaces for dense data and glass only on light surfaces. Every page supplies loading/empty/error/success states, destructive/sensitive actions use confirmation, `config.useMock` remains functional per slice, UI is English with no more than one short Filipino phrase per screen (never on buttons, labels or errors).

## 3. API contract

All URLs below are relative to `/api/v1`. Existing endpoints are marked **Existing**; planned endpoints are **Proposed** and are not implemented. Existing contracts must be reconciled with the canonical fields here during the relevant phase. All Customer-private endpoints require `auth:sanctum` and active Customer capability. Every resource endpoint must authorize access to the authenticated user's own record; never accept `user_id` from the client. Business-mode order/reservation attempts must be denied by the backend, unverified accounts may browse but cannot order/reserve, and no user may order from a restaurant they own or actively work at.

Standard response convention for new endpoints: JSON `{ "data": ... }`; validation errors use the Laravel JSON validation envelope. Paginated collections include `data` and `meta`. Sensitive provider keys remain backend-only.

### Account, profile, addresses and location (C1)

| Method and URL | Request | Response | Rules / status |
|---|---|---|---|
| `GET /auth/me` | None | Existing current-account object including capabilities, modes, membership `permissions[]`, selected mode and restaurant | **Existing.** Authenticated. |
| `GET /customer/profile` | None | Existing user resource | **Existing.** Authenticated Customer. |
| `PATCH /customer/profile` | Existing request: `{name?,phone?}`. **Proposed canonical request:** `{first_name,middle_name?,last_name,suffix?,mobile?,birthday?}` | Existing resource: `{id,name,email,phone,avatar_url,status,capabilities,memberships,active_mode,selected_restaurant_id,email_verified_at,driver_state}` | **Existing**, but current request collapses name into first/last and must be aligned with the canonical profile schema. `avatar_url` currently resolves to null. Sensitive fields require frontend confirmation. |
| `DELETE /customer/profile` | `{password,reason?}` | `{message}` | **Existing.** Password confirmation; deactivation, not hard-delete; revoke sessions and retain transaction history. |
| `GET /customer/settings` | None | `{notifications,promotions,reservationReminders,darkMode,soundAlerts}` | **Existing**, currently session-backed rather than durable across sessions/devices. |
| `PATCH /customer/settings` | Allowed preference/settings fields | Updated settings resource | **Existing.** Do not use this as a substitute for email/password change endpoints. |
| `GET /customer/addresses` | Optional pagination | Address collection, default first | **Existing but transient.** Replace session-memory repository with persistent UserAddress repository. |
| `POST /customer/addresses` | Legacy request uses free-text hierarchy, `is_main`, and `rider_note`; v3 mapping: `{psgc_code?,address_type,label,custom_label?,street?,house_no?,latitude?,longitude?,delivery_note?,is_default?}` | Legacy resource adapted to v3 address fields | **Existing route, transient.** Use v3 columns. `address_type` is home/work/church/other; encode School as `other` plus `label=School`. Enforce one default in a transaction; require valid location/coordinates for delivery. |
| `GET /customer/addresses/{address}` | None | Address resource | **Proposed endpoint over v3 `user_addresses`.** Own address only; 404 for another user's address. |
| `PATCH /customer/addresses/{address}` | Partial v3 address fields as above | Address resource mapped to v3 | **Existing route, transient.** Update only the authenticated user's address; atomically maintain one default and enforce delivery completeness when used for checkout. |
| `DELETE /customer/addresses/{address}` | None | `{deleted:true}` | **Existing.** Confirmation in UI; if deleting default while other addresses remain, atomically select another default; no default when there are zero addresses. |
| `PATCH /customer/addresses/{address}/primary` | `{}` | Address resource with `is_default=true` | **Existing route.** Legacy path retained as a route adapter; service transaction ensures one default maximum. |
| `GET /locations/psgc?level={region\|province\|city\|barangay}&parent_code=&search=` | Query | PSGC records `{code,parent_code,name}` | **Existing public endpoint.** Currently one level per request; dataset import unverified. |
| `GET /locations/search?q=` | Query | `{suggestions:[{code,name,level,hierarchy,label}]}` | **Proposed.** Cross-level fuzzy PSGC type-ahead; `Zamboanga` must include city, provinces and Sibugay with hierarchy. |
| `GET /customer/locations/places?q=&country=PH` | Query | Place suggestions with formatted text and coordinates | **Proposed.** Backend-only autocomplete provider, PH-limited, timeout/cache/friendly fallback; provider terms/free limits [VERIFY]. |
| `POST /customer/locations/reverse-geocode` | `{latitude,longitude}` | `{formatted_text,psgc_code?,accuracy_hint}` | **Proposed.** Validate Philippines coordinates; backend calls single-lookup provider; expose no secret. |
| `POST /customer/delivery-quotes` | `{restaurant_id,latitude,longitude}` | `{distance_km,fee,within_radius,method:"route"\|"estimate",eta_range?}` | **Proposed.** Backend route provider and settings determine distance, radius and fee. No checkout without a valid pin and in-radius result. |
| `POST /customer/profile/email-change/otp` and `POST /customer/profile/email-change/verify` | Destination email; verification code | Status / updated profile | **Proposed.** New email requires fresh one-time OTP, rate limit, destination binding, and confirmation. |
| `PATCH /customer/profile/password` | `{current_password,new_password,new_password_confirmation}` | `{message}` | **Proposed.** Current-password check, confirmation, revoke other sessions. |

The existing OTP service generates six-digit codes, stores only hashes, supports email verification/business email/rider activation/email change purposes, and reads validity/cooldown/attempt limits from settings/config. The registered email-verification send/verify endpoints are implemented; customer email-change routes are not.

`Use my current location` is browser geolocation, not a server endpoint. The browser sends the coordinates to reverse-geocode; denied, unavailable and timeout cases fall back to manual entry. Store only coordinates and formatted text on an address; do not store provider payloads.

### Browse and favorites (C2)

| Method and URL | Request | Response | Rules |
|---|---|---|---|
| `GET /restaurants/popular` | Optional location and limit | Popular public restaurant cards | Guests see only popular restaurants. |
| `GET /restaurants` | `q,cuisine,filipino_only,dietary[],open_24_7,open_now,service_type,rating,sort,latitude,longitude,page,per_page` | Paginated public restaurant cards | Approved + Published only; server-side filters/search/sort/pagination; distance/open status derived. |
| `GET /restaurants/categories` | None | Cuisine/category list | Public approved list. |
| `GET /restaurants/{restaurant}` | None | Public restaurant detail, hours, photos, dietary badges, reservation capability, menu categories/items and review summary | Only Approved + Published restaurants; omit draft/archived menu records. |
| `GET /restaurants/{restaurant}/menu` | `q,category_id,dietary[]` | Searchable menu groups | Published items shown; unavailable/sold-out shown disabled; never orderable. |
| `GET /restaurants/{restaurant}/reviews` | Pagination | Public visible reviews | Hidden reviews omitted. |
| `GET /customer/favorites` | `type?` | Favorite restaurant and menu-item resources | Authenticated Customer; own data only. |
| `PUT /customer/favorites/restaurants/{restaurant}` | `{}` | `{favorited:true}` | Idempotent; favorite only a valid public restaurant. |
| `DELETE /customer/favorites/restaurants/{restaurant}` | None | `{favorited:false}` | Own favorite only. |
| `PUT /customer/favorites/menu-items/{item}` / `DELETE ...` | `{}` / none | Favorite state | Item must belong to a public restaurant; own favorite only. |

### Cart, quote, discounts and atomic checkout (C3)

| Method and URL | Request | Response | Rules |
|---|---|---|---|
| `GET /customer/carts` | None | Non-expired carts grouped by restaurant with item availability and `expires_at` | One reusable cart row per user/restaurant; derive activity from expiry and contents; several restaurants coexist; no stock reservation. |
| `POST /customer/carts/{restaurant}/items` | `{item_id,quantity,note?}` | Updated cart | Verify public restaurant and item association; enforce quantity limits. Add-on/options payload is not supported because v3 has no options structure. |
| `PATCH /customer/carts/{restaurant}/items/{item}` | `{quantity,note?}` | Updated cart | Quantity zero removes; prices are current display hints, not trusted totals. |
| `DELETE /customer/carts/{restaurant}/items/{item}` / `DELETE /customer/carts/{restaurant}` | None | Updated/empty cart | Own cart only. |
| `POST /customer/checkout/quote` | `{orders:[{restaurant_id,order_type,address_id?,discount_code?,payment_method}]}` | Per-order subtotal/fees/discount/total, derived grand total, eligibility/validation messages | Backend computes all prices; one address per Delivery order; Pickup has no delivery fee; validate restaurant/menu/availability, own-work restriction, hours, radius, settings and discount. Quote does not reserve stock. |
| `POST /customer/checkout` | Same order sections plus optional `scheduled_for`; `Idempotency-Key` header | `201 {checkout_group:{reference_code,orders:[...]},grand_total}` | Verified email and Customer mode required. Validate every section again inside one DB transaction; all-or-nothing; server re-reads item prices, limits, stock, fee settings and discounts. Create one order per restaurant, per-order payment attempts, history and redemptions; snapshot address and amounts; grand total derived, never stored. Duplicate key returns the original group. V3 order FK is `checkout_id`; `order_type` values are `delivery`/`pickup`. |
| `POST /customer/discounts/validate` | `{restaurant_id,code,subtotal,eligible_items?}` | `{valid,discount_amount,message,scope}` | Backend validation only; platform discount applies to one chosen order in a group. Never trust a client amount when placing. |

Payment methods: Delivery uses Cash on Delivery; Pick-up uses pay-at-pick-up. Online banks/GCash are returned as unavailable/coming-soon and cannot be submitted. Discount validation covers scope, active dates, minimum, usage and per-customer limits, v3 `type=first_order`, caps and non-negative totals. Cancellation/rejection releases stock and discount redemptions transactionally. V3 permits multiple `payments` rows per order; do not assume one-to-one payment cardinality.

### Orders, tracking, receipts, reviews and notifications (C4)

| Method and URL | Request | Response | Rules |
|---|---|---|---|
| `GET /customer/orders` | `status?,from?,to?,page,per_page` | Paginated own orders and groups | Customer derived through CheckoutGroup; no other customer's data. |
| `GET /customer/orders/{order}` | None | Order details, items, fee/discount/payment/address snapshots and status history | Own order only; reference code is public identifier, not authorization. |
| `POST /customer/orders/{order}/cancel` | `{reason?}` | Updated order | Only Placed; confirmation required in UI; atomically release stock/redemption; other group orders unaffected. |
| `GET /customer/orders/{order}/tracking` | None | Order status/timeline, ETA, route/distance, restaurant, rider card and last location timestamp | Own order only. Rider location visible only to this customer, authorized restaurant members and Admin; cache TTL about two minutes; driver data is a Phase 4 dependency. |
| `POST /customer/orders/{order}/receipt-confirmation` | `{received:boolean}` | Updated order; if false, support ticket reference | Only Delivered, own order, single-use. Yes completes; No creates Admin support ticket. No answer auto-completes after configured 24 hours. |
| `POST /customer/orders/{order}/reviews/restaurant` | `{rating:1..5,comment?}` | Restaurant review | Receipt-confirmed Completed order, one review per order, reject owner/staff reviewing their own restaurant. |
| `POST /customer/orders/{order}/reviews/rider` | `{rating:1..5,comment?}` | Rider review | Only if a delivery/rider exists; one review per delivery using v3 `rider_reviews`. |
| `GET /customer/notifications` | `unread_only?,page,per_page` | Own notifications | Customer ownership enforced. |
| `PATCH /customer/notifications/{notification}/read` | `{}` | Updated notification | Own notification only. |

Tracking polls every 5–10 seconds, pauses while the tab is hidden and backs off on errors. Local mode uses a mock rider simulator; production does not fabricate a live rider. Pick-up shows directions to the restaurant without rider tracking.

### Reservations (C5)

| Method and URL | Request | Response | Rules |
|---|---|---|---|
| `GET /restaurants/{restaurant}/reservation-slots` | `date,guest_count,duration_minutes?` | Available slots with suitable table IDs/labels and capacity | Public restaurant must accept reservations; disclose no other customer's booking. Reuse shared availability logic; enforce hours, 24/7, closure, capacity, slot interval and booking window. |
| `POST /customer/reservations` | `{restaurant_id,table_id,start_at,duration_minutes?,guest_count,reserved_for_name,contact_phone,special_request?}` | `201` reservation resource | Verified email and Customer mode. Transaction locks/rechecks table and overlap; at most 3 active reservations; Pending or Confirmed by restaurant policy. |
| `GET /customer/reservations` | `status?,from?,to?,page,per_page` | Own upcoming/past reservations | Never return other customers' bookings. |
| `GET /customer/reservations/{reservation}` | None | Reservation plus restaurant/table summary | Own reservation only. |
| `POST /customer/reservations/{reservation}/cancel` | `{reason?}` | Updated v3 reservation resource | Own reservation; enforce restaurant cutoff. V3 has no late-cancel field; do not emit or persist a late-cancel indicator unless an existing status supports it. |
| `POST /customer/reservations/{reservation}/reschedule` | Not enabled | — | **[VERIFY]** V3 has no reschedule-request state/table. Until the owner changes v3, cancel and book a new slot; do not claim a pending restaurant approval request. |

### Settings, partner/rider links and help (C6)

| Method and URL | Request | Response | Rules |
|---|---|---|---|
| Avatar upload | Not offered | — | V3 has no avatar path; do not persist an avatar or add a user column. |
| `GET /customer/support/tickets` | `status?,page,per_page` | Own tickets and latest reply | Uses SupportTicket/TicketMessage; Admin access is separate. |
| `POST /customer/support/tickets` | `{subject,body,order_id?}` | `201` ticket resource | Authenticated Customer; referenced order must belong to requester. Includes receipt-confirmation disputes. |
| `GET /customer/support/tickets/{ticket}/messages` | None | Own ticket messages | Private to requester and authorized support staff. |
| `POST /customer/support/tickets/{ticket}/messages` | `{body}` | `201` message | Own open ticket only. |
| `GET /applications/restaurants/mine` and existing restaurant application endpoints | Existing application contract | Application status/resource | Existing Customer-capability route family; partner form is an application flow, not a Customer-owned restaurant shortcut. |
| `GET /applications/riders/mine`, `POST /applications/riders` | Rider application fields/documents | Application/status card | **Phase 4 dependency.** Customer mode only; not implemented in the current API. |

Settings UI links to profile, addresses, password/email changes and account deactivation. Sensitive changes require confirmation; deactivation requires password and retains history. Business users attempting checkout or rider application receive a clear instruction to switch to Customer mode.

## 4. Customer mapping to authoritative schema v3

V3 is the physical schema. These are mappings and runtime rules, not schema proposals. Use the existing table names and constraints; do not create parallel tables, new columns, migrations, or database objects here.

| V3 table(s) | Customer use and constraints |
|---|---|
| `users`, `auth_tokens`, `platform_settings` | Use v3 profile/auth/settings fields only. Password reset is a known mismatch: v3 `auth_tokens.purpose` omits `password_reset`, while legacy auth code issues it; preserving password reset requires an owner decision on a v3-compatible path [VERIFY]. No avatar/onboarding column. |
| `user_addresses`, `psgc_locations` | `user_addresses` has nullable PSGC/coordinates and `address_type` enum home/work/church/other; label/custom_label are text. School maps to `other` with label `School`. Enforce one default in a locked service transaction; require a complete valid pin for delivery. |
| `restaurants`, `cuisine_types`, `restaurant_cuisines`, `operating_hours`, `closure_dates`, `menu_categories`, `menu_items`, `dietary_tags`, `menu_item_dietary_tags`, `restaurant_photos` | Browse only approved/published restaurants; ratings are derived from reviews. Match v3 fields; no `restaurants.category` field is assumed. |
| `favorite_restaurants`, `favorite_menu_items` | Use the v3 table names and composite keys; no duplicate `restaurant_favorites` or `menu_item_favorites`. |
| `carts`, `cart_items` | Unique one cart row per `(user_id,restaurant_id)`; no status. Derive activity from item presence and `expires_at`, use `updated_at` for inactivity, and reuse/clear the row. `cart_items.item_id` references `menu_items.id`; no add-on structure is represented, so arbitrary options are [VERIFY] and disabled. |
| `checkout_groups`, `orders`, `order_items`, `order_status_histories`, `payments`, `discounts`, `discount_redemptions` | Use v3 `orders.checkout_id`, `order_type`, `delivery_address_id`, recipient and address snapshots, and cancellation actor type/user. Payment rows are one-to-many per order because `payments.order_id` is not unique. Discount first-order is a type, not a flag. Checkout must be atomic/idempotent; cross-row total and item-count invariants are service rules. |
| `restaurant_tables`, `reservation_settings`, `reservations` | Use v3 statuses/fields. No late-cancel flag or reschedule-request state/table exists; persist only available reservation fields and audit mutations. Customer reschedule request is [VERIFY] and disabled; cancel/rebook meanwhile. |
| `restaurant_reviews`, `rider_reviews` | Use v3 unique order/delivery review relations. Enforce customer ownership, completed/receipt-confirmed state and self-review restrictions in policies/services. |
| `support_tickets`, `ticket_messages`, `notifications`, `audit_logs` | Use v3 tables. `ticket_messages.user_id` identifies every sender, including Admin users; verify Admin capability through `platform_admins`. Use audit records for application/review decisions and other audited changes. |
| `deliveries`, `delivery_offers`, `rider_profiles`, `rider_documents`, `rider_shift_assignments`, `zones`, `shifts`, `zone_shift_capacities` | Use v3 Driver/dispatch structures. Live rider location remains cache-only with a short TTL; `delivered_at` is the proof capture/completion timestamp. Require proof path and valid coordinates in the delivery-completion service; the schema does not enforce that state invariant. |
| `platform_settings` | Store string values under agreed setting keys; fee and ETA values are snapshotted on each order. Setting types/ranges and complete seed values remain [VERIFY]; audit setting updates. |

### Scheduler jobs

Existing scheduled jobs: invitation expiry every 15 minutes; audit pruning daily; menu quantity reset, unanswered Business order cancellation, and pending reservation expiry every minute (the last three use one-server/overlap protections).

Customer work will use the existing v3 design:

- Expire inactive carts after seven days; run at least daily and idempotently. V3 has no cart status, so clear `cart_items` and reuse the cart row; no stock is restored because carts reserve none.
- Auto-confirm Delivered orders after the configured 24-hour receipt window; run frequently enough to respect the configured window, transactionally complete each order once, and leave rating available.
- Reservation pending-hold expiry already exists as a Business scheduler; reuse, do not add a duplicate job. Notifications/order status emails should be queued on state changes, not implemented as extra schedulers without a need.

## 5. [VERIFY] decisions and gates

- Confirm official PSGC source/version and import dataset availability.
- Verify current provider terms, quotas and privacy treatment before choosing geocoding, autocomplete, routing and map tile providers. Keep API keys in backend `.env`; do not send addresses or coordinates to third parties without approved privacy disclosure.
- Confirm supported MySQL version and CHECK-constraint behavior. Address-default uniqueness is service-enforced; v3 cart pair uniqueness is already defined.
- Confirm exact email-change OTP lifetime/cooldown and account deactivation/anonymization retention values from approved settings.
- Arbitrary menu add-ons/options are disabled because v3 has no options structure.
- Support uses v3 `support_tickets`/`ticket_messages`; Admin identity is checked via `platform_admins`. Confirm status transitions and retention before enabling the UI.
- Customer reschedule approval requests are disabled; use cancel/rebook until the owner updates v3.
- Password reset remains [VERIFY]: v3 token purposes omit `password_reset`, while legacy auth code uses it. Preserve the feature, but do not claim v3-compatible persistence until the owner resolves the mismatch.
- Confirm fee/ETA setting keys and types, complete seed values, Admin attribution, and order snapshot behavior. V3 stores setting values as strings and order amounts/address as snapshots.
- V3 delivery proof fields are nullable; require proof path and coordinates in the delivery-completion service. Treat `delivered_at` as the capture/completion timestamp.
- Popularity and rating sort values are derived from v3 order/review records, not stored aggregates; verify query/index performance before production-scale use.
- Confirm route API/auth semantics for guests: guest browse may access popular restaurants and public pages only; other Customer features must use the feature-gate preview.
- V3 cannot support multiple restaurant Owners; the owner will update the SQL. No Customer or Business code work may assume an additional Owner until the schema is revised.

**C0 stop:** this document maps Customer behavior to authoritative schema v3. No C1 implementation or migration has been started.
