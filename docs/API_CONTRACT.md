# SALO API Contract

**Status:** Phase A proposal. This is a contract for review, not an implemented API.

## Conventions

- Base path: `/api/v1`. All responses use JSON and the envelope below.
- Browser authentication uses Laravel Sanctum's stateful SPA session cookie. Before a state-changing request, the SPA requests `GET /sanctum/csrf-cookie` (outside `/api/v1`), then sends the session cookie and `X-XSRF-TOKEN`. Do not issue or expose bearer tokens for the first-party SPA.
- There is one account per person. Every account receives customer capability. Driver and admin are platform-level capabilities. Restaurant owner, manager, reservation manager, and staff are per-restaurant memberships with permissions. A person may have memberships at several restaurants and different membership roles at each one.
- `Guest` means no authenticated session. Guest access to restaurant data is limited to `GET /api/v1/public/restaurants/popular`; location lookups and authentication endpoints are not restaurant listings.
- Resource IDs are opaque strings. Monetary request/response values use decimal strings in Philippine pesos, not client-calculated totals.
- Lists return pagination metadata. Default and maximum page sizes are implementation configuration and must be documented before release.
- Every controller response is serialized through an API Resource; endpoints return no raw model or unwrapped provider payload.
- Dates use ISO 8601. Local restaurant schedules and reservation times are evaluated in `Asia/Manila`; timestamps include their UTC offset or `Z`.

### Success envelope

```json
{
  "data": {},
  "meta": {}
}
```

`meta` is omitted when it has no applicable fields. Paginated collections include `current_page`, `per_page`, `last_page`, and `total`.

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The submitted data is invalid.",
    "fields": {
      "email": ["Enter a valid email address."]
    }
  }
}
```

Use stable codes including `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `ACCOUNT_DEACTIVATED`, `ACCOUNT_SUSPENDED`, `RESTAURANT_UNAVAILABLE`, `MENU_ITEM_UNAVAILABLE`, `CART_VALIDATION_FAILED`, `DISCOUNT_INVALID`, `RESERVATION_UNAVAILABLE`, `INVALID_STATUS_TRANSITION`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`, and `LOCATION_PROVIDER_UNAVAILABLE`. Field details are omitted when not applicable. Validation returns `422`; unauthenticated `401`; forbidden `403`; missing/hidden resource `404`; conflict `409`; rate limit `429`; provider outage `503`. No failed operation returns a success-shaped response.

### Common resource shapes

- **User:** `id`, `name`, `email`, `phone`, `avatar_url`, `status` (`active`, `deactivated`, `suspended`), platform `capabilities`, memberships, `email_verified_at`, and applicable profile fields. Never include password, reset token, session ID, or private credentials.
- **Membership:** `restaurant_id`, `role` (`owner`, `manager`, `reservation_manager`, `staff`), `status` (`invited`, `active`, `suspended`, `removed`), effective `permissions[]`, invitation expiry where pending, and timestamps.
- **Restaurant:** `id`, `owner_id` only in owner/admin contexts, `name`, `description`, `cuisine`, `address`, `latitude`, `longitude`, `status`, `service_modes`, `is_24_7`, `operating_hours`, computed `is_open_now`, `menu`, and public-safe contact/display fields. Public results include only approved, active restaurants.
- **Menu item:** `id`, `category_id`, `name`, `description`, positive `price`, `is_active`, `availability` (`available` or `sold_out`), and configured options. An inactive or sold-out item is not orderable.
- **Order:** `id`, `checkout_group_id`, `restaurant_id`, `customer_id` only in owner/admin contexts, `status`, `service_mode`, line-item snapshots, server-calculated `subtotal`, fees, discount allocation, `total`, cancellation reason when applicable, and timestamps.
- **Checkout group:** `id`, customer, idempotency result, member orders, and derived `grand_total`. The grand total is calculated from its orders and is never stored as an independent total.
- **Reservation:** `id`, `restaurant_id`, `table_id`, guest count, start/end timestamps, status, and timestamps; customer and private guest-contact fields are hidden from unrelated users.
- **Application:** `id`, applicant, application type, submitted details, status (`pending`, `approved`, `rejected`), decision reason, and timestamps. Restaurant operational state is separate from application state.
- **Delivery job:** `id`, `order_id`, `status`, public job-board summary, driver assignment, milestone timestamps, cash-collection state, and delivery-code state. Private customer contact/address is omitted from unclaimed jobs.
- **Driver location:** ephemeral last-known coordinate and `recorded_at`; cached only with short TTL, never represented as a history collection.
- **Upload:** `id`, purpose, safe display metadata, public URL only for public assets, and authorized short-lived URL for private documents. Never return storage paths or client-supplied filenames.

## Endpoint registry

Unless noted, request bodies are JSON. `—` means no body. Route parameters are opaque resource IDs. `customer`, `rider` (legacy URL namespace; platform capability is `driver`), and `admin` denote platform capabilities. `owner` in the existing restaurant endpoint rows is shorthand for an active restaurant membership with the permission named by the operation, not a platform role. Policies additionally enforce resource ownership and relationships.

### Public discovery

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `GET /public/restaurants/popular` | Optional `limit` (server-capped), `page` | Paginated `Restaurant[]`; approved/public-safe fields only | Guest, customer, owner, rider, admin |

This is the sole unauthenticated restaurant listing. The endpoint must not return pending, rejected, suspended, inactive, or owner-private restaurant data.

### Authentication and account

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `POST /auth/register` | `name`, `email`, `password`, `password_confirmation`, optional `phone`, optional `address` | `User` with customer capability; session cookie set | Guest |
| `POST /auth/login` | `email`, `password` | `User`; session cookie set | Guest |
| `POST /auth/logout` | — | `{ "message": "Logged out." }`; session invalidated | Any authenticated capability |
| `GET /auth/me` | — | User status, platform `capabilities[]`, memberships with effective permissions, driver approval/availability state | Any authenticated capability |
| `POST /auth/forgot-password` | `email` | Non-enumerating generic confirmation | Guest |
| `POST /auth/reset-password` | `email`, `token`, `password`, `password_confirmation` | Generic confirmation; session behavior follows Laravel reset policy | Guest |
| `POST /auth/email/verification/send` | — | Generic confirmation | Authenticated account |
| `POST /auth/email/verification/verify` | Verification code/token | Updated verified user state | Authenticated account |
| `GET /customer/profile` | — | Current user's profile | customer |
| `PATCH /customer/profile` | Allowed profile fields, e.g. `name`, `phone` | Updated `User` | customer |
| `DELETE /customer/profile` | `password` confirmation and optional `reason` | Deactivation confirmation | customer |
| `GET /customer/settings` | — | User preference resource | customer |
| `PATCH /customer/settings` | Supported notification/preferences fields | Updated preference resource | customer |

Registration grants `customer` only. Login is rate-limited and rejects deactivated or suspended accounts without disclosing which account state or credential was wrong. Account deactivation is a soft-delete operation, invalidates sessions, and does not erase order or reservation history.

### Location proxy

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `GET /locations/regions` | Optional `q` | PSGC-compatible `Location[]` | Guest, customer, owner, rider, admin |
| `GET /locations/regions/{region}/provinces` | Optional `q` | `Location[]` | Guest, customer, owner, rider, admin |
| `GET /locations/provinces/{province}/cities-municipalities` | Optional `q` | `Location[]` | Guest, customer, owner, rider, admin |
| `GET /locations/cities-municipalities/{city}/barangays` | Optional `q` | `Location[]` | Guest, customer, owner, rider, admin |
| `GET /locations/places/search` | Required explicit `q`; optional bounded `limit` | Normalized `Place[]` | Guest, customer, owner, rider, admin |
| `GET /locations/places/reverse` | Required numeric `lat`, `lon` | Normalized `Place` | Guest, customer, owner, rider, admin |

Location responses normalize to `code`/`id`, `name`, hierarchical codes where available, and optional coordinates/address components. Provider errors return `LOCATION_PROVIDER_UNAVAILABLE` with a safe fallback message, not raw upstream bodies.

PSGC proxy resource paths verified for this proposal: `/regions/`, `/regions/{regionCode}/provinces/`, `/provinces/{provinceCode}/cities-municipalities/`, and `/cities-municipalities/{cityCode}/barangays/` at [PSGC API](https://psgc.gitlab.io/api/). Nominatim uses `/search` for explicit searches and `/reverse` for coordinate lookups; use `format=jsonv2`, `countrycodes=ph`, bounded results, an identifying `User-Agent`, cache, timeouts, and visible OpenStreetMap attribution. The public Nominatim service forbids autocomplete and requires a maximum of one request per second per application. Do not send personal/confidential address content upstream. These restrictions apply to the public OSMF service; changing provider requires configuration, not a client release. See the [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/), [Reverse API](https://nominatim.org/release-docs/latest/api/Reverse/), and [Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).

### Restaurant discovery and menu (authenticated)

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `GET /restaurants` | Optional `q`, `cuisine`, `service_mode`, `open_now`, `featured`, `page` | Paginated approved `Restaurant[]` | customer |
| `GET /restaurants/categories` | — | Categories derived from approved, visible catalog | customer |
| `GET /customer/home` | — | Customer home sections composed from authorized restaurants, orders, and categories | customer |
| `GET /restaurants/{restaurant}` | — | Approved `Restaurant` detail | customer |
| `GET /restaurants/{restaurant}/menu` | Optional `category_id`, `page` | Active public `MenuCategory[]` and visible items | customer |
| `GET /restaurants/{restaurant}/availability` | Required `date`, `time`, `guests`; optional `service_mode` | Availability summary and eligible slot/table result | customer |

No public restaurant search, detail, menu, availability, category, or owner listing is exposed to guests. Only the popular endpoint above is public.

### Customer addresses and carts

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `GET /customer/addresses` | — | Current user's `Address[]` | customer |
| `POST /customer/addresses` | Address components, coordinates if selected, `label`, optional `rider_note` | Created `Address` | customer |
| `PATCH /customer/addresses/{address}` | Editable address fields | Updated `Address` | customer |
| `DELETE /customer/addresses/{address}` | — | `{ "deleted": true }` | customer |
| `PATCH /customer/addresses/{address}/primary` | — | Updated primary `Address` | customer |
| `POST /customer/delivery-quotes` | `restaurant_id`, `address_id`, `service_mode`; no trusted client distance/fee | Server quote with distance/fee source and expiry | customer |
| `GET /customer/carts` | — | Current user's restaurant-partitioned carts | customer |
| `PUT /customer/carts/{restaurant}` | `service_mode` (`delivery` or `walk_in`), `items[]` with `menu_item_id`, positive `quantity`, option IDs | Updated cart with server-priced line snapshots and expiry | customer |
| `DELETE /customer/carts/{restaurant}` | — | `{ "deleted": true }` | customer |

Cart writes re-check restaurant state, service mode, menu-item activity and availability. Carts expire according to configured policy; exact TTL is an implementation configuration and must be set before launch.

### Customer checkout, discounts, and orders

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `POST /customer/discounts/quote` | `code`, `restaurant_id`, `service_mode`, `items[]` with `menu_item_id`, `quantity` | Server quote: subtotal, eligible discount, fees, final order total, expiry | customer |
| `POST /customer/checkout-groups` | `orders[]`; each has `restaurant_id`, `service_mode`, `address_id` when delivery, recipient/contact, optional `scheduled_at`, optional `discount_code`, and `items[]` with item/option IDs and quantities. Required `Idempotency-Key` header. | Created `CheckoutGroup` with all `Order[]` and derived `grand_total` | customer |
| `GET /customer/checkout-groups` | Optional `page` | Paginated `CheckoutGroup[]` | customer |
| `GET /customer/checkout-groups/{group}` | — | Owned `CheckoutGroup` | customer |
| `GET /customer/orders` | Optional `status`, `page` | Paginated current user's `Order[]` | customer |
| `GET /customer/orders/{order}` | — | Owned `Order` | customer |
| `POST /customer/orders/{order}/cancel` | Optional `reason` | Updated `Order` | customer |

The client sends identifiers and quantities, never authoritative prices, fees, discounts, or totals. The server validates every member order before any write, returns a store-attributed `CART_VALIDATION_FAILED` if any fails, and otherwise creates the group and all its orders inside one transaction boundary. Replaying a key with the same normalized request returns the original result; reusing it for different input returns `IDEMPOTENCY_KEY_REUSED`. Customer cancellation is allowed only while `pending`.

### Customer reservations

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `POST /customer/reservations` | `restaurant_id`, `date`, `time`, `guests`, optional guest note | Created `Reservation` in `pending` | customer |
| `GET /customer/reservations` | Optional `status`, `page` | Paginated current user's `Reservation[]` | customer |
| `GET /customer/reservations/{reservation}` | — | Owned `Reservation` | customer |
| `POST /customer/reservations/{reservation}/cancel` | Optional `reason` | Updated `Reservation` | customer |

The reservation create action checks valid future date/time, capacity, table maintenance, restaurant opening hours or 24/7 flag, and overlapping reservations. It locks the candidate table row inside the transaction before checking for overlap. Customer cancellation is allowed until two hours before start.

### Owner onboarding and owned restaurant operations

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `POST /applications/restaurants` | Restaurant identity, address/location, contact, cuisine, service modes, opening-hours declaration, required application details | `Application` pending | customer |
| `GET /applications/restaurants/mine` | Optional `page` | Current applicant's `Application[]` | customer |
| `GET /owner/restaurants` | Optional `page` | Restaurants with an active membership for current account | `restaurant:restaurant.view` |
| `GET /owner/restaurants/{restaurant}` | — | Authorized `Restaurant` detail | `restaurant:restaurant.view` |
| `GET /owner/restaurants/{restaurant}/dashboard/overview` | Optional `range` | Restaurant metrics and operational summary | `restaurant:analytics.view` |
| `PATCH /owner/restaurants/{restaurant}` | Allowed editable restaurant profile, service modes, `is_24_7` | Updated `Restaurant` | `restaurant:restaurant.edit` |
| `PUT /owner/restaurants/{restaurant}/operating-hours` | Complete validated weekly schedule and timezone | Updated schedule | `restaurant:restaurant.edit` |
| `PATCH /owner/restaurants/{restaurant}/accepting-orders` | `accepting_orders` boolean | Updated operational state | `restaurant:restaurant.edit` |
| `GET /owner/restaurants/{restaurant}/orders` | Optional `status`, `page` | Paginated authorized restaurant orders | `restaurant:orders.view` |
| `PATCH /owner/restaurants/{restaurant}/orders/{order}/status` | `status` from allowed next transition; `reason` when cancelling | Updated `Order` | `restaurant:orders.manage` |
| `GET /owner/restaurants/{restaurant}/reservations` | Optional `status`, `date`, `page` | Paginated reservations for authorized restaurant | `restaurant:reservations.view` |
| `PATCH /owner/restaurants/{restaurant}/reservations/{reservation}/status` | `status` (`confirmed`, `completed`, `cancelled`, `no_show`); cancellation reason when applicable | Updated `Reservation` | `restaurant:reservations.manage` |

Restaurant members can reach only resources belonging to restaurants where they have an active membership and the specific permission. Membership and policy checks run at every nested route; a submitted owner or restaurant ID is never trusted. Deactivation of a member account or suspension/removal of its membership immediately revokes access. Deactivation of an owning account closes its restaurants to new orders and reservations but preserves history.

### Owner menu, table, and discount operations

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `POST /owner/restaurants/{restaurant}/menu-categories` | `name`, optional `sort_order` | Created category | `restaurant:menu.manage` |
| `PATCH /owner/restaurants/{restaurant}/menu-categories/{category}` | `name`, optional `sort_order`, `is_active` | Updated category | `restaurant:menu.manage` |
| `DELETE /owner/restaurants/{restaurant}/menu-categories/{category}` | — | `{ "deleted": true }` | `restaurant:menu.manage` |
| `POST /owner/restaurants/{restaurant}/menu-items` | `category_id`, `name`, optional `description`, positive `price`, `is_active`, `availability`, optional options | Created `MenuItem` | `restaurant:menu.manage` |
| `PATCH /owner/restaurants/{restaurant}/menu-items/{item}` | Editable item fields; `is_active` and `availability` are independent | Updated `MenuItem` | `restaurant:menu.manage` |
| `DELETE /owner/restaurants/{restaurant}/menu-items/{item}` | — | `{ "deleted": true }` | `restaurant:menu.manage` |
| `GET /owner/restaurants/{restaurant}/tables` | Optional `page` | Authorized restaurant tables | `restaurant:tables.manage` |
| `POST /owner/restaurants/{restaurant}/tables` | `name`, positive `capacity` | Created table | `restaurant:tables.manage` |
| `PATCH /owner/restaurants/{restaurant}/tables/{table}` | `name`, positive `capacity`, `is_under_maintenance` | Updated table | `restaurant:tables.manage` |
| `DELETE /owner/restaurants/{restaurant}/tables/{table}` | —; reject if history/active reservation prevents removal | `{ "deleted": true }` | `restaurant:tables.manage` |
| `GET /owner/restaurants/{restaurant}/discounts` | Optional `active`, `page` | Authorized restaurant discounts | `restaurant:discounts.manage` |
| `POST /owner/restaurants/{restaurant}/discounts` | Code, type/value, optional max cap, minimum order, start/end, usage limit, funding source `restaurant` | Created restaurant-funded discount | `restaurant:discounts.manage` |
| `PATCH /owner/restaurants/{restaurant}/discounts/{discount}` | Editable discount fields | Updated discount | `restaurant:discounts.manage` |
| `DELETE /owner/restaurants/{restaurant}/discounts/{discount}` | —; disables future use | `{ "deleted": true }` | `restaurant:discounts.manage` |

### Driver onboarding and operations (legacy `/rider` URL namespace)

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `POST /applications/rider` | Required applicant identity/contact/residence, vehicle/application data, and private upload IDs as required by approved policy | `Application` pending | customer |
| `GET /applications/rider/mine` | Optional `page` | Current applicant's `Application[]` | customer |
| `GET /rider/dashboard/overview` | Optional `range` | Driver dashboard overview | driver |
| `PATCH /rider/availability` | `is_online` boolean | Updated availability | driver |
| `GET /rider/jobs` | Optional `page` | Public-safe unclaimed delivery jobs; excludes customer contact/address | driver |
| `POST /rider/jobs/{job}/claim` | — | Claimed job; private fulfillment details become available only after successful claim | driver |
| `GET /rider/jobs/assigned` | Optional `status`, `page` | Current driver's assigned jobs | driver |
| `POST /rider/jobs/{job}/milestones` | Next allowed `status`; proof/confirmation fields when required | Updated assigned job/order | assigned driver |
| `PUT /rider/jobs/{job}/location` | `latitude`, `longitude`, optional `recorded_at` | Accepted timestamp; no location history | assigned driver |

Driver approval adds `driver` platform capability to the applicant's existing account. A pending or rejected application grants no driver access. The `/rider` URL prefix is retained temporarily for frontend compatibility only. Job claim is first-claim-wins and atomic; eligibility checks require an active approved driver who is online. Private customer details are not present in the job-board response. Location is short-lived cache state, never a persisted trail.

### Restaurant memberships and invitations

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `GET /owner/restaurants/{restaurant}/members` | Optional `status`, `page` | Memberships for that restaurant | `restaurant:team.manage` |
| `POST /owner/restaurants/{restaurant}/invitations` | `email`, `role` (`manager`, `reservation_manager`, `staff`), optional expiry | Pending invitation; no duplicate account creation | `restaurant:team.manage` |
| `POST /team-invitations/{token}/accept` | Authenticated account with matching email | Active membership and effective permissions | Signed-in invitee |
| `POST /owner/restaurants/{restaurant}/invitations/{invitation}/revoke` | — | Revoked invitation | `restaurant:team.manage` |
| `PATCH /owner/restaurants/{restaurant}/members/{membership}` | Policy-allowed `role` or `status` change | Updated membership | `restaurant:team.manage` |
| `DELETE /owner/restaurants/{restaurant}/members/{membership}` | — | Removed membership | `restaurant:team.manage` |

Only the restaurant owner may grant or alter membership roles. Invitations cannot grant owner, driver, or admin capability. Acceptance requires a matching authenticated email; invitation tokens are opaque, single-use, expiring, and stored hashed. Role-specific permission grants and owner transfer are [VERIFY] product policy; until resolved, role changes cannot elevate the owner or grant more than the matrix in `ROLE_PERMISSION_MATRIX.md`.

### Delivery tracking

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `GET /customer/orders/{order}/tracking` | — | Authorized delivery state, ETA, and last location if available | Owning customer |
| `GET /owner/restaurants/{restaurant}/orders/{order}/tracking` | — | Driver location for an active assigned delivery | `restaurant:orders.view` |

Driver location is short-lived cache state, not a persisted trail. Location access is limited to the assigned driver, the order's customer, authorized staff for the originating restaurant while delivery is active, and admin under audited operational access. Stop location collection when the delivery ends.

### Uploads and directions

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `POST /uploads` | Multipart file, declared `purpose` and associated resource | Safe upload metadata and opaque `id` | Authenticated; resource policy applies |
| `DELETE /uploads/{upload}` | — | `{ "deleted": true }` | Uploader or authorized resource manager |
| `GET /locations/directions` | `origin`, `destination`, optional `profile` | Normalized geometry, distance, duration and attribution | Relevant delivery participants; map preview access [VERIFY] |

Uploads require a server allowlist of purposes, MIME and file-signature checks, size limits, randomized storage names, private storage by default, authorization on access, and cleanup of unattached files. Never expose a raw storage path or trust client filenames. Private application documents use authorized, short-lived URLs.

### Admin operations

Superseded by [docs/ADMIN_API_CONTRACT.md](./ADMIN_API_CONTRACT.md).

## Status transitions and authorization summary

- **Restaurant:** `pending` → `approved` or `rejected`; `approved` → `suspended` by admin. Only `approved` restaurants with an active owning account are public/orderable/reservable. A member with `restaurant.edit` may pause accepting new orders without changing approval state.
- **Driver application:** `pending` → `approved` or `rejected` by admin. Approval adds the `driver` capability; rejection does not.
- **Order:** `pending` → `confirmed`; `confirmed` → `preparing` → `ready` by a restaurant member with order-management permission; delivery `ready` → `out_for_delivery` → `completed` by assigned driver; walk-in/pickup `ready` → `completed` by an authorized restaurant member. Customer may cancel only `pending`. Authorized member/admin cancellation after that requires a reason. Terminal `completed`/`cancelled` cannot transition.
- **Reservation:** `pending` → `confirmed` by a member with reservation-management permission; `pending`/`confirmed` → `completed`, `cancelled`, or `no_show` by an authorized member/admin subject to policy. Customer cancels their own reservation at least two hours before start.
- **Menu orderability:** item `is_active = true` and `availability = available`, category active, approved restaurant accepting the selected service mode, and current hours/availability checks must all pass.
- **Discount:** active, inside inclusive configured date window, minimum subtotal met, usage remains, correct funding and scope; calculate percentage/fixed amount, apply maximum cap, then derive final order total.

## Operational security contract

- Apply `ForceJson` to `/api/v1`; validate all input with FormRequests; use policies for nested resources and ownership; never trust client capability/owner IDs.
- Apply platform-capability or restaurant-membership-permission middleware to grouped routes and policy checks to object routes. Admin authority does not bypass documented reason/audit requirements.
- Apply login throttling and anti-enumeration behavior to password reset. Enforce Sanctum stateful domains, secure session cookie settings, CSRF, explicit credentialed CORS origins, and browser-compatible cookie configuration.
- Require `Idempotency-Key` for checkout-group creation. Persist/replay key and normalized request outcome at the transaction boundary once the database schema is approved.
- Exclude private customer data from restaurant-member/driver responses unless needed to fulfill that specific order/reservation; exclude unrelated restaurants' data.
- Every endpoint not listed in this registry is out of contract and must not be added to `routes/api.php` without updating this document and approval.
