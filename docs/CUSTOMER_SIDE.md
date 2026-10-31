# SALO Customer Side

**Status:** C0 address-design revision approved for documentation on 2026-10-31; C1 remains blocked. [DATABASE_SCHEMA_V3.sql](./DATABASE_SCHEMA_V3.sql) remains the authoritative physical schema and the owner edits it. The SQL has not been changed and no database exists or migration has been applied. Do not execute v3 because it begins with DROP/CREATE DATABASE statements. Existing C1 source code predates the approved revision and is not compliant implementation for the revised address design. Approval here does not start C1.

## 1. C0 prerequisite and implementation audit

There is no database; no migrations have been applied. The files in `backend/database/migrations` are unrun source and do not establish that tables exist. The supplied v3 SQL is the intended physical design only. Nothing in this audit assumes that any table exists at runtime. PHP 8.0.30 is also below the installed Composer requirement (>= 8.4.1), so backend runtime tests could not establish database behavior.

| Prerequisite | What exists | C0 assessment |
|---|---|---|
| Login, registration, password reset, email verification | Laravel auth controllers/services, hashed auth tokens, session middleware, OTP verification endpoints and tests | Exists. Email delivery configuration and production OTP delivery still need environment verification. |
| Modes, capabilities, `/auth/me` | Session-backed active mode and selected restaurant; `/api/v1/auth/me`; capability middleware | Exists. Backend gates remain authoritative. |
| PermissionMap | `PermissionMap` derives permissions from restaurant roles | Exists for Business. `UserAddressPolicy` now scopes Customer address operations; policies for orders, reviews, and reservations remain absent. |
| PSGC hierarchy | `psgc_locations`, importer, repository, public level/parent and search endpoints | Cross-level PSGC type-ahead and imported `full_name` values exist in source. The requested province/city/barangay parent-filtered address flow and NCR/independent-city handling are not verified; official data import remains unverified and requires the v3 schema to exist. |
| Public/private local storage | Local public and private disks, public-photo and private-document storage services | Exists for Business/application uploads. Customer location provider, reverse-geocoding, street autocomplete, and route/ETA provider adapters do not exist. |
| Platform settings | `platform_settings` migration proposal and database repository | Repository/service source exists; no table exists in a live database. Customer fee/radius/ETA setting keys and seeded values are not established. |
| Business restaurant/menu/hours/tables/discounts | Business services plus intended migration files for restaurant, menu, hours, tables, reservation settings, discounts and redemptions | Business-side code exists. These migrations are unapplied; none of those tables exists in a live database. `ReservationAvailabilityService` validates availability and creates reservations internally, but is not a public customer booking API and does not yet enforce Customer email verification or the three-active-reservation cap. |
| Customer account/profile | Authenticated `GET/PATCH /api/v1/customer/profile`, `DELETE /profile`, and `GET/PATCH /settings` | Endpoints exist. Customer authorization relies on `auth:sanctum` plus `capability:customer`; no dedicated Customer policy is wired. Profile currently edits a combined `name` and `phone`; avatar URL is always null. Settings are held in the session, not persisted in the database. Deactivation checks password but does not persist the optional reason or implement retention/anonymization. |
| Customer saved addresses | Address routes, FormRequests, Resource, `AddressService`, `UserAddress` model, database repository and policy | Existing source targets current v3 fields but predates this address revision. It does not meet the new ordered fields, country storage, formatted-address, reverse-geocoding, or full PSGC parent-validation requirements. Do not treat it as approved C1 behavior. |
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

1. V3 defines `user_addresses`, but its single optional `psgc_code` and nullable components do not fully represent the revised address fields. The owner has confirmed the intended column changes; the owner will edit v3. No schema change is made here. Enforce delivery completeness and exactly one default transactionally.
2. V3 already has nullable `orders.delivery_address_id` and immutable address text/coordinate snapshots, plus recipient name/phone. Use these fields; do not add another address snapshot table.
3. V3 already has carts, cart items, checkout groups, orders, favorites, reviews, support tickets/messages, notifications and discount redemptions. Use the existing names and keys; do not add parallel Customer tables.
4. V3 represents first-order discount as a `discounts.type` value, not `first_order_only`. Align Business/Customer contracts to the v3 type; do not retain the old flag.
5. The existing address API/source predates this revision. It must not be treated as the final contract. V3 currently provides `is_default`, `delivery_note`, one `psgc_code`, `address_type`, `label`, `custom_label`, street, and house number; the requested country, hierarchy representation, formatted-address persistence, and parent validation remain schema decisions for the owner.
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
- **C1:** blocked pending owner approval of this address revision and confirmation of required schema columns. After approval, persist the confirmed address fields; enforce one default per user in a service transaction because the v3 index is not unique; validate every PSGC code and parent plus the agreed coordinate bounds. Do not add avatar/onboarding columns; settings remain session-backed unless represented in v3.
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
| Home and first-use guidance | `/` and CustomerHome | A skippable three-step welcome and next-best-action card are implemented. Completion is stored in browser local storage only. Restaurant/home data remains mock-backed. |
| Browse, search, restaurant and menu | `/restaurants`, `/restaurants/:id` | Mock fixtures and client filtering; server-side approved/published filtering, pagination, authoritative availability and public APIs required. |
| Location and addresses | Profile address form, header location controls, location picker; checkout address selection; restaurant location editor; rider home-location editor | Revised order for every address surface: Country, Province, City or Municipality, Barangay, Street, House number. Country displays Philippines and is locked for now. PSGC hierarchy fields are local type-ahead with parent restrictions; persist one barangay leaf code and derive ancestors. Street is free text with optional backend-called, PH-limited suggestions. Current-location reverse geocoding fills editable fields; dragging the pin refreshes them. Show and store a one-line formatted address. The design is owner-approved; source remains pre-revision, and C1 is blocked until PSGC data and database readiness. Provider limits, terms, and privacy remain [VERIFY]. |
| Cart and checkout | `/cart`, `/checkout` | Browser storage/mock calculations; must become authenticated backend carts and server-quoted atomic multi-restaurant checkout. |
| Orders and tracking | `/orders`, `/orders/:id` | Mock order records and simulation. Backend customer ownership endpoints and driver/tracking records are missing. |
| Reservations | `/reservations`, `/reservations/new`, `/reserve` | Mock Customer reservation data. Business availability service exists; authenticated Customer endpoints are missing. |
| Profile and settings | `/profile`, `/settings` | Profile/settings APIs exist; address durability, email-change OTP, password/session revocation contract and sensitive confirmations need verification/completion. |
| Favorites | No dedicated route found | Missing. |
| Receipt confirmation, rating, help and notifications | No Customer route/API found | Missing. |
| Partner/rider links | `/partner/apply`, `/rider/apply` | Application entry points exist; Customer-mode gating/status integration must be checked. Rider application backend is outside Customer C0. |

### C1 — account and location (blocked pending PSGC data and database readiness)

**C1 must not start until all four prerequisites are met.** The owner approved the address policy and intended schema columns on 2026-10-31; the v3 SQL still needs the owner's edits, and no database is ready. Existing C1 source code is pre-revision and is not accepted as satisfying these requirements.

- [x] Address fields confirmed
- [x] Schema columns confirmed by me
- [ ] PSGC data loaded
- [ ] Database ready

#### Address form and behavior

The order applies consistently to saved customer addresses, checkout delivery addresses, restaurant locations, and rider home locations:

1. **Country** — first, displayed as Philippines and locked while the Philippines is the only supported country. Store `country_code="PH"` so other countries can be enabled later.
2. **Province** — PSGC type-ahead, not a dropdown. Typing `Zamboanga` must offer Zamboanga City, Zamboanga del Norte, Zamboanga del Sur, and Zamboanga Sibugay, each with its complete hierarchy. If a user starts by typing a city, offer a qualified suggestion such as `Zamboanga City, Zamboanga Peninsula`; selecting it fills the province/region context and city.
3. **City or Municipality** — PSGC type-ahead constrained to the selected province. If the selected city is directly under a region, use the region context instead.
4. **Barangay** — PSGC type-ahead constrained to the selected city or municipality.
5. **Street** — required free text; optional autocomplete suggestions come from a provider called through the backend and restricted to the Philippines. The user can always keep or edit manual text.
6. **House number** — optional free text, including values such as `Blk 3 Lot 5`, `Unit 4B`, or a building name.

PSGC v3 models `region`, `province`, `city`, and `barangay`; there is no separate municipality level, so a municipality is represented by a `city`-level row. Province, city/municipality, and barangay suggestions come only from the local PSGC table. Ordinary cities/municipalities are children of a province. NCR has a region row and city/municipality rows directly under it, with no province rows: show `Metro Manila (NCR)` in the Province position and skip province selection. An independent city outside NCR, such as Zamboanga City, is represented by a `city` row whose `parent_code` points directly to its region rather than a province: show `None (independent city)` in the Province position and skip province selection. Determine these cases from the selected city's PSGC parent and the NCR region; do not invent a province PSGC code. Every child choice clears and reloads all lower fields.

Confirmed required fields: Country, Province (except the two cases above), City/Municipality, Barangay, and Street. House number, delivery note, and address label are optional. Labels are Home, Work, School, or Church; Other is stored as custom text. Confirmed mapping: Home/Work/Church match `address_type`; School is `address_type=other,label=School`; Other is `address_type=other,label=Other,custom_label=<text>`.

`Use my current location` obtains a pin and asks the backend to reverse-geocode it into all address fields. All returned fields remain editable. Dragging the map pin repeats reverse geocoding and refreshes the fields. Show one final formatted address line and store that text with the address. Coordinates continue to use the agreed coarse Philippine bounds from one config value; return a clear out-of-bounds error and test it. This is not exact polygon validation; exact Philippine boundary checking remains deferred [VERIFY].

The backend repeats every validation: each selected PSGC record must exist, levels must be appropriate, and each code must be a child of the selected parent (including barangay-to-city). Submit the selected province/city/barangay codes for validation, but persist only the barangay leaf in the existing `psgc_code`; derive city, province, and region names from the local PSGC parent chain. Street suggestions and reverse geocoding are backend-only behind the single `locationService` interface; provider keys stay in `backend/.env` and are never hard-coded or sent to the browser. Street remains free text and the draggable pin/manual flow is the fallback, so optional autocomplete is not a C1 gate. Address and coordinate data may be sent to a third-party provider: send only the minimum required fields, never SALO user IDs, and disclose this transfer before use.

Provider evaluation is [VERIFY] before production use: evaluate **Geoapify** first for Philippines-limited street/landmark autocomplete, with **Photon** and **LocationIQ** as alternatives. For each, verify free-tier request limits, terms/attribution, geographic coverage, retention/processing location, and privacy impact. **Nominatim is allowed only for a single reverse-geocoding lookup** initiated by “Use my current location”: custom User-Agent, at most one request per second per application, caching, timeout, and applicable attribution/terms [VERIFY]. Do not use Nominatim for type-ahead. For reverse-geocoded province/city/barangay, resolve the result against the local PSGC table; provider administrative names are not authoritative. If a provider is unavailable, keep manual street text and the editable pin available.

#### Read-only schema comparison

The following describes columns in `DATABASE_SCHEMA_V3.sql` only; no table is assumed to exist at runtime and no schema edit is made here.

| Field / surface | Where it exists today | Missing or different | Recommendation / question for owner |
|---|---|---|---|
| Country | Absent from `user_addresses`, `restaurants`, `rider_profiles`, and order snapshots; `zones` is a geofence and is excluded. | UI requires a visible stored country. | **Owner-approved:** add `country_code CHAR(2)` with current value `PH` to saved-address, restaurant, rider-home, and delivery-order snapshot records. |
| Province | Only indirectly represented through a single optional PSGC FK on user addresses, restaurants, and zones; absent on rider profiles/orders. | NCR and independent cities have no province row; no independent province code should be invented. | **Owner-approved:** derive province/region from the canonical barangay code's local PSGC parent chain; keep only display values for the skipped province position. |
| City or Municipality | Same single PSGC FK on user addresses, restaurants, and zones; no code on rider profile or order snapshot. | Municipality is a PSGC `city` level; no dedicated stored city code is needed. | **Owner-approved:** derive city/municipality and region ancestors from the stored barangay code. |
| Barangay | A single `psgc_code` can point to a barangay, but its current schema is nullable and does not constrain level. No such code exists on rider home. | Required for every complete saved/restaurant/rider address; each parent must match. | **Owner-approved:** store one barangay leaf code in `psgc_code` for user addresses/restaurants and add the equivalent field for rider home. Make it required for complete addresses; validate level and ancestry in the backend. |
| Street | Nullable `user_addresses.street` and `restaurants.street`; no rider-home street. | Required by the approved address policy. | Owner to make required on completed address records and add to rider home. Keep street free text; autocomplete is optional and backend-only. |
| House number | Nullable `user_addresses.house_no VARCHAR(40)`; absent from restaurants/rider home/order snapshots. | Optional free text, including unit, lot/block, or building name. | Keep the existing 40-character limit; add nullable house-number fields for restaurant and rider-home addresses. Do not snapshot components into orders. |
| Label and custom label | `label VARCHAR(40) NOT NULL DEFAULT 'Home'`, `custom_label VARCHAR(60) NULL`, and `address_type ENUM('home','work','church','other')`. | School is not an enum; custom mapping needs application validation. | **Owner-approved:** Home/Work/Church match `address_type`; School uses `other` plus `label=School`; Other uses `other`, `label=Other`, and custom text in `custom_label`. |
| Delivery note | Nullable `user_addresses.delivery_note`; no corresponding restaurant/rider field. | Optional only for customer delivery addresses. | Keep delivery note optional on saved customer addresses. **Owner-approved:** order snapshot does not need a separate note because the formatted address and coordinates are sufficient. |
| Latitude and longitude | Nullable on user addresses/restaurants; zones have center coordinates; rider profile has nullable `home_lat/home_lng`; orders have nullable delivery coordinates. | Coordinates must follow coarse Philippine bounds; no SQL coordinate check is defined. | Retain the single shared coarse bounds config, clear error, and test. Exact boundary check remains deferred [VERIFY]. |
| Default flag | `user_addresses.is_default` with `(user_id,is_default)` index, not unique. | Schema does not enforce uniqueness. | **Confirmed:** enforce exactly one default transactionally when addresses exist; no schema uniqueness change requested. |
| PSGC code(s) | `user_addresses.psgc_code`, `restaurants.psgc_code`, `zones.psgc_code` are nullable FKs; no rider-home PSGC code. `psgc_locations.parent_code` has no self-FK. | Codes do not guarantee selected level or ancestry. | **Owner-approved:** persist one barangay PSGC leaf code for full addresses and derive ancestors locally; `zones.psgc_code` remains an optional geofence code. Add a PSGC parent self-FK per the previously accepted integrity recommendation; backend still validates every chain. |
| Formatted address text | No `user_addresses`/`restaurants` formatted field. `orders.delivery_address_text VARCHAR(300)` is the existing snapshot. Rider home has coordinates only. | Saved/restaurant/rider records cannot retain the final formatted line. | Add `formatted_address` to saved addresses, restaurants, and rider home; use the existing order text plus coordinates as the immutable order snapshot. Keep the existing 300-character order limit. |
| Restaurant location | `restaurants.psgc_code`, `street`, coordinates; `restaurant_applications.draft_details`/`proposed_changes` may contain untyped JSON. | No country, house number, or formatted field; no structured address guarantee. | Add country code, barangay leaf code, street, optional house number, formatted address, and coordinates to the approved restaurant location; JSON remains draft/proposal data only. |
| Zone | `zones.psgc_code`, center latitude/longitude, radius, and name. | This is a dispatch geofence, not a postal address. | **Owner-approved:** keep zones as geofences; no full address or country field is required. |
| Rider home location | `rider_profiles.home_lat` and `home_lng` only. | Missing country, barangay code, street, optional house number, and formatted text. | Add `country_code`, barangay leaf PSGC code, street, nullable house number, formatted address, and home coordinates. |
| Order delivery address snapshot | `orders.delivery_address_id`, `delivery_address_text VARCHAR(300)`, delivery coordinates, recipient name/phone. | Country code is absent; there are no separate component/code/note snapshots. | **Owner-approved:** add delivery `country_code`; the existing formatted text plus coordinates are sufficient and immutable. No separate component, PSGC-code, or delivery-note snapshot is requested. |

#### Owner decisions and remaining [VERIFY] items

The owner confirmed on 2026-10-31: required/optional fields; `country_code="PH"` on address-bearing records/snapshots; one stored barangay code with ancestors derived; the label mapping; formatted order text plus coordinates as sufficient; zones remain geofences; and existing text limits remain. The owner edits the SQL; this confirmation does not mean v3 has been changed or a database is ready.

- Evaluate Geoapify first for Philippines-limited street/landmark autocomplete; Photon and LocationIQ are alternatives. For **each**, verify free-tier request limits, terms/attribution, coverage, retention/processing location, and privacy impact [VERIFY]. Do not use a provider for type-ahead unless its terms allow it.
- Nominatim is for a single reverse-geocoding lookup only, never autocomplete. Verify applicable terms/attribution and privacy impact [VERIFY]; enforce a custom User-Agent, one request per second per application, caching, and timeout.
- All provider requests pass through the backend behind the `locationService` interface. Keep keys in `backend/.env`; never hard-code keys or send user IDs. Send only the minimum address/coordinate data required. Disclose that addresses and coordinates may be sent to third parties.
- Province, city, and barangay values come only from local PSGC. Reverse-geocoded administrative values must be resolved against and validated with that table.
- Official PSGC import and data-level checks for NCR and independent-city parentage remain prerequisites.
- Exact Philippine boundary validation remains deferred [VERIFY]; retain the agreed coarse bounds with a clear error and test.
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
| `POST /customer/addresses` | **Proposed revised request:** `{country_code:"PH",province_code?,city_code,barangay_code,street,house_no?,formatted_address,address_type?,label?,custom_label?,delivery_note?,latitude?,longitude?,is_default?}`. Province is omitted for NCR and independent cities; province/city/barangay codes are submitted for validation. | Address resource returns the ordered components, derived hierarchy, `formatted_address`, coordinates, note/label, and default state. | **Existing route, current source is pre-revision.** Backend validates existence, level, and parent-child relationships, then persists only the selected barangay code as `user_addresses.psgc_code`; province/city/region are derived from local PSGC. `country_code="PH"` is stored. |
| `GET /customer/addresses/{address}` | None | Address resource | **Proposed endpoint over v3 `user_addresses`.** Own address only; 404 for another user's address. |
| `PATCH /customer/addresses/{address}` | Partial revised address fields as above; parent changes require valid descendants | Updated revised Address resource | **Existing route, current source is pre-revision.** Update only the authenticated user's address; validate hierarchy and atomically maintain one default. |
| `DELETE /customer/addresses/{address}` | None | `{deleted:true}` | **Existing.** Confirmation in UI; if deleting default while other addresses remain, atomically select another default; no default when there are zero addresses. |
| `PATCH /customer/addresses/{address}/primary` | `{}` | Address resource with `is_default=true` | **Existing route.** Legacy path retained as a route adapter; service transaction ensures one default maximum. |
| `GET /locations/psgc?level={region\|province\|city\|barangay}&parent_code=&search=` | Query | PSGC records `{code,parent_code,name,level,full_name}` | **Existing public endpoint.** Use type-ahead, not dropdowns; city search can return qualified `City, Province` entries. The official dataset and NCR/independent-city parentage remain unverified. |
| `GET /locations/psgc/search?q=&level=&parent_code=` | Query | `{suggestions:[{code,parent_code,name,level,hierarchy,label}]}` | **Proposed revised contract.** Province search for `Zamboanga` includes the named city and provinces; city and barangay results are restricted to the selected parent. For a city typed first, return qualified hierarchy and selecting it fills its province/region context. |
| `GET /locations/places/search?q=&country=PH` | Query | Street suggestions with formatted text and optional coordinates | **Proposed.** Backend-only provider, limited to Philippines; manual street text remains available. Provider, terms, privacy disclosure, quota, timeout/cache and failure behavior [VERIFY]. |
| `POST /locations/places/reverse` | `{latitude,longitude}` | `{country_code:"PH",province_code?,province_display,city,barangay,street?,house_no?,formatted_address,latitude,longitude}` | **Proposed.** Backend validates coarse bounds and calls approved PH-limited provider; validate all returned PSGC codes/parentage; expose no secret. For NCR/independent city, `province_code` is absent and `province_display` is the specified skip value. Fields remain editable. |
| `POST /customer/delivery-quotes` | `{restaurant_id,latitude,longitude}` | `{distance_km,fee,within_radius,method:"route"\|"estimate",eta_range?}` | **Proposed.** Backend route provider and settings determine distance, radius and fee. No checkout without a valid pin and in-radius result. |
| `POST /customer/profile/email-change/otp` and `POST /customer/profile/email-change/verify` | Destination email; verification code | Status / updated profile | **Proposed.** New email requires fresh one-time OTP, rate limit, destination binding, and confirmation. |
| `PATCH /customer/profile/password` | `{current_password,new_password,new_password_confirmation}` | `{message}` | **Proposed.** Current-password check, confirmation, revoke other sessions. |

The existing OTP service generates six-digit codes, stores only hashes, supports email verification/business email/rider activation/email change purposes, and reads validity/cooldown/attempt limits from settings/config. The registered email-verification send/verify endpoints are implemented; customer email-change routes are not.

`Use my current location` is browser geolocation, not a server endpoint. The browser sends coordinates to the backend reverse-geocode route; denied, unavailable, timeout, and provider errors leave manual entry and the draggable pin available and must not return success-shaped data. Dragging the pin repeats reverse-geocoding and refreshes editable fields. Resolve administrative divisions from local PSGC, not provider labels. Persist the final formatted line with the address; do not store raw provider payloads. Checkout, restaurant location, and rider home-location forms use the same address field order and parent validation.

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

V3 is the physical schema. These are mappings and runtime rules, not schema edits. Reuse existing tables; do not create parallel tables, migrations, or database objects here. The owner-approved address column additions are recorded in the C1 comparison, but only the owner may edit v3, and C1 cannot begin until the updated schema and database are ready.

| V3 table(s) | Customer use and constraints |
|---|---|
| `users`, `auth_tokens`, `platform_settings` | Use v3 profile/auth/settings fields only. Password reset is a known mismatch: v3 `auth_tokens.purpose` omits `password_reset`, while legacy auth code issues it; preserving password reset requires an owner decision on a v3-compatible path [VERIFY]. No avatar/onboarding column. |
| `user_addresses`, `psgc_locations` | Owner-approved design: store `country_code="PH"` and one barangay leaf in `psgc_code`; derive city/province/region from local PSGC. Add `formatted_address`; make country, barangay code, and street required for a complete address. Keep optional house number, delivery note, and label; map School/Other through existing type/text fields as confirmed above. Current v3 lacks `country_code`/`formatted_address`, allows nullable code/street, and does not enforce code level/parentage. Enforce hierarchy/defaults in service and retain coarse coordinate validation; the owner edits v3 before C1. |
| `restaurants`, `cuisine_types`, `restaurant_cuisines`, `operating_hours`, `closure_dates`, `menu_categories`, `menu_items`, `dietary_tags`, `menu_item_dietary_tags`, `restaurant_photos` | Browse only approved/published restaurants; ratings are derived from reviews. Match v3 fields; no `restaurants.category` field is assumed. |
| `favorite_restaurants`, `favorite_menu_items` | Use the v3 table names and composite keys; no duplicate `restaurant_favorites` or `menu_item_favorites`. |
| `carts`, `cart_items` | Unique one cart row per `(user_id,restaurant_id)`; no status. Derive activity from item presence and `expires_at`, use `updated_at` for inactivity, and reuse/clear the row. `cart_items.item_id` references `menu_items.id`; no add-on structure is represented, so arbitrary options are [VERIFY] and disabled. |
| `checkout_groups`, `orders`, `order_items`, `order_status_histories`, `payments`, `discounts`, `discount_redemptions` | Use v3 `orders.checkout_id`, `order_type`, `delivery_address_id`, recipient and address snapshots, and cancellation actor type/user. Add delivery `country_code`; the existing immutable formatted text plus coordinates are the approved snapshot, with no component/code/note copies. Payment rows are one-to-many per order because `payments.order_id` is not unique. Discount first-order is a type, not a flag. Checkout must be atomic/idempotent; cross-row total and item-count invariants are service rules. |
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

**C1 gate:** The address revision and intended columns are approved, but C1 implementation remains paused until official PSGC data is loaded and the owner-edited schema is deployed to a ready database. Existing pre-revision source is not accepted as satisfying the address requirements. No migration or database operation is authorized here; the owner edits `DATABASE_SCHEMA_V3.sql`. Provider terms/quotas/privacy and exact Philippine boundary validation remain [VERIFY].
