# SALO Schema v3 Gap Report

**Scope:** Read-only comparison of [DATABASE_SCHEMA_V3.sql](./DATABASE_SCHEMA_V3.sql), [SALO_PLAN_v2.md](./SALO_PLAN_v2.md), [CUSTOMER_SIDE.md](./CUSTOMER_SIDE.md), [BUSINESS_SIDE.md](./BUSINESS_SIDE.md), and repository migrations/models. The v3 SQL is treated as the owner's source of truth for this report. This document does not modify that SQL, run migrations, or create/change a database.

**Database state:** There is no database and no migrations have been applied. The Laravel migration files and models are source code only; no table in the inventory below is asserted to exist at runtime. The v3 file is a standalone blueprint, not a Laravel migration.

**Important execution warning:** The supplied SQL starts with `DROP DATABASE IF EXISTS salo; CREATE DATABASE salo;`. It is destructive if run against an existing database. It was not run. Do not execute it against an environment containing data.

## 1. Table inventory

All tables use the v3 schema's `id` convention unless noted. Foreign keys below are written as `column -> referenced table.column`; nullable FKs are marked `nullable`. Purpose is summarized from the schema comments/columns.

| Table | Primary key | Foreign keys | Purpose |
|---|---|---|---|
| `users` | `id` | — | Account identity, credentials, profile, status and soft-delete marker. |
| `platform_admins` | `id` | `user_id -> users.id` | Admin capability and status for a user. |
| `auth_tokens` | `id` | `user_id -> users.id` | Hashed one-time OTPs, verification and activation tokens. |
| `psgc_locations` | `code` | **No declared FK** for `parent_code` | PSGC region/province/city/barangay hierarchy and full-text search names. |
| `platform_settings` | `setting_key` | nullable `updated_by -> users.id` | Admin-configurable platform values. |
| `cuisine_types` | `id` | — | Controlled restaurant cuisine vocabulary. |
| `restaurants` | `id` | `owner_user_id -> users.id`; nullable `psgc_code -> psgc_locations.code` | Restaurant profile, location, publication and operational status. |
| `audit_logs` | `id` | nullable `actor_user_id -> users.id`; nullable `restaurant_id -> restaurants.id` | Platform/restaurant audit trail, including system events. |
| `notifications` | `id` | `user_id -> users.id` | User notifications and read state. |
| `restaurant_applications` | `id` | nullable `restaurant_id -> restaurants.id`; `submitted_by -> users.id`; nullable `reviewed_by -> users.id` | Initial restaurant application and sensitive-update review workflow. |
| `application_documents` | `id` | `application_id -> restaurant_applications.id` | Private restaurant application documents and expiry/verification metadata. |
| `restaurant_photos` | `id` | `restaurant_id -> restaurants.id` | Public restaurant gallery paths and generated image variants. |
| `restaurant_staff` | `id` | `restaurant_id -> restaurants.id`; `user_id -> users.id` | Non-owner restaurant membership, role and membership status. |
| `invitations` | `id` | `restaurant_id -> restaurants.id`; `staff_id -> restaurant_staff.id`; `user_id -> users.id`; `invited_by -> users.id` | Hashed, expiring, single-use staff invitations linked to a membership. |
| `restaurant_cuisines` | composite `(restaurant_id,cuisine_id)` | `restaurant_id -> restaurants.id`; `cuisine_id -> cuisine_types.id` | Restaurant-to-cuisine junction. |
| `operating_hours` | `id` | `restaurant_id -> restaurants.id` | Weekday shifts and overnight schedule flags. |
| `closure_dates` | `id` | `restaurant_id -> restaurants.id` | Restaurant closure dates and reasons. |
| `reservation_settings` | `restaurant_id` | `restaurant_id -> restaurants.id` | One restaurant's reservation policy and slot configuration. |
| `menu_categories` | `id` | `restaurant_id -> restaurants.id` | Restaurant-owned menu categories and ordering/archive state. |
| `menu_items` | `id` | `category_id -> menu_categories.id` | Menu content, price, lifecycle, availability and quantity. Restaurant is derived through category. |
| `dietary_tags` | `id` | — | Controlled dietary/allergen labels. |
| `menu_item_dietary_tags` | composite `(item_id,tag_id)` | `item_id -> menu_items.id`; `tag_id -> dietary_tags.id` | Menu-item-to-tag junction. |
| `user_addresses` | `id` | `user_id -> users.id`; nullable `psgc_code -> psgc_locations.code` | Customer saved addresses, coordinates, labels and default selection. |
| `carts` | `id` | `user_id -> users.id`; `restaurant_id -> restaurants.id` | One customer/restaurant cart with expiry timestamp. |
| `cart_items` | `id` | `cart_id -> carts.id`; `item_id -> menu_items.id` | Item quantity and note within a cart. |
| `checkout_groups` | `id` | `user_id -> users.id` | Idempotent multi-restaurant checkout grouping and public reference. |
| `orders` | `id` | `checkout_id -> checkout_groups.id`; `restaurant_id -> restaurants.id`; nullable `delivery_address_id -> user_addresses.id`; nullable `cancelled_by_user_id -> users.id` | One restaurant's order, status, itemized totals and address/price snapshots. |
| `order_items` | `id` | `order_id -> orders.id`; `item_id -> menu_items.id` | Immutable item-name/price snapshots, quantity and note. |
| `order_status_histories` | `id` | `order_id -> orders.id`; nullable `changed_by -> users.id` | Timestamped order transitions and reasons; null actor means system. |
| `payments` | `id` | `order_id -> orders.id` | Per-order method, payment status, amount and optional provider reference. |
| `discounts` | `id` | nullable `restaurant_id -> restaurants.id`; `created_by -> users.id` | Platform or restaurant discount terms, scope and eligibility type. |
| `discount_redemptions` | `id` | `discount_id -> discounts.id`; `order_id -> orders.id`; `user_id -> users.id` | Applied/released discount usage per order and customer. |
| `restaurant_tables` | `id` | `restaurant_id -> restaurants.id` | Restaurant table capacity and availability status. |
| `reservations` | `id` | `user_id -> users.id`; `table_id -> restaurant_tables.id`; nullable `responded_by -> users.id`; nullable `cancelled_by -> users.id` | Customer reservation and state/timing; restaurant is derived through table. |
| `restaurant_reviews` | `id` | `order_id -> orders.id`; `user_id -> users.id` | Customer's restaurant rating/comment and restaurant reply/moderation state. |
| `favorite_restaurants` | composite `(user_id,restaurant_id)` | `user_id -> users.id`; `restaurant_id -> restaurants.id` | Customer restaurant favorites. |
| `favorite_menu_items` | composite `(user_id,item_id)` | `user_id -> users.id`; `item_id -> menu_items.id` | Customer menu-item favorites. |
| `support_tickets` | `id` | `user_id -> users.id`; nullable `order_id -> orders.id`; nullable `assigned_admin_id -> users.id` | Support issue linked optionally to a customer order and assigned admin. |
| `ticket_messages` | `id` | `ticket_id -> support_tickets.id`; `user_id -> users.id` | Ticket conversation messages, with sender represented as a user row. |
| `zones` | `id` | nullable `psgc_code -> psgc_locations.code` | Geographic dispatch zones. |
| `shifts` | `id` | — | Named rider work shifts. |
| `zone_shift_capacities` | composite `(zone_id,shift_id)` | `zone_id -> zones.id`; `shift_id -> shifts.id` | Maximum rider capacity by zone and shift. |
| `rider_profiles` | `id` | `user_id -> users.id`; nullable `approved_by -> users.id` | Rider application, approval, activation and availability profile. |
| `rider_documents` | `id` | `rider_id -> rider_profiles.id` | Private rider document paths and verification. |
| `rider_preferred_shifts` | composite `(rider_id,shift_id)` | `rider_id -> rider_profiles.id`; `shift_id -> shifts.id` | Rider shift preferences. |
| `rider_shift_assignments` | `id` | `rider_id -> rider_profiles.id`; nullable `zone_id -> zones.id`; `shift_id -> shifts.id`; nullable `assigned_by_user_id -> users.id` | Assigned or waitlisted rider capacity slots and override attribution. |
| `deliveries` | `id` | `order_id -> orders.id`; nullable `rider_id -> rider_profiles.id` | Delivery lifecycle, private proof path, coordinates, earnings and cash. |
| `delivery_offers` | `id` | `delivery_id -> deliveries.id`; `rider_id -> rider_profiles.id` | Rider dispatch offers and acceptance/decline/timeout history. |
| `rider_reviews` | `id` | `delivery_id -> deliveries.id`; `user_id -> users.id` | Customer rating/comment for the rider on a delivery. |

The schema also calls out Laravel-managed `sessions`, `personal_access_tokens`, `jobs`, `cache`, and `migrations`; these are explicitly outside the 49 application tables above and require separate framework configuration/migrations.

## 2. Differences: v3 schema vs plan, docs, migrations and models

Each row records a concrete divergence. “What would need to change” is a decision/action for later, not work performed here. The v3 SQL governs schema decisions under the owner's instruction; conflicts are surfaced rather than silently reconciled.

| Item | My schema (v3) | Plan or code | What would need to change |
|---|---|---|---|
| **Restaurant ownership cardinality** | `restaurants.owner_user_id` is one required owner; `restaurant_staff.staff_role` excludes `owner`. | Owner's rule is several Owners; an Owner cannot transfer ownership but can add another Owner. Manager ownership-change requests are removed. Existing code assumes one Owner and contains legacy transfer behavior. | **[VERIFY]:** owner will update v3 to represent Owner membership and an add-Owner invitation path. Update authorization only after the schema change is approved; do not implement transfer or Manager request flows. |
| Plan v2 §19 primary-key convention | V3 uses `id` for most tables, with natural/composite keys for settings, PSGC and pure junctions. | Plan §19 labels entity-specific PKs (`user_id`, `restaurant_id`, `order_id`, etc.); current Laravel migrations/models use a mixture (`admin_id`, `token_id`, `log_id`, normal `id`). | Align Eloquent primary-key metadata, route binding, foreign-key names and repositories to v3's exact keys; do not generate migrations from the older plan. |
| User password/status/deletion fields | `password_hash`, email `VARCHAR(190)`, mobile `VARCHAR(20)`, plus `deleted_at`. | Existing migration/model uses `password`, mobile length 32, no `deleted_at`; Auth/UserRepository writes `password`. Plan says password hash but does not require the column name. | Map Laravel's auth password accessor to `password_hash`; implement soft-delete/anonymization behavior consistently; adjust request validation/lengths and SQL-backed repository. |
| Platform admins | PK `id`; `updated_by` elsewhere points to `users.id`. | Foundation migration uses PK `admin_id`; `PlatformSetting::updater()` belongs to `PlatformAdmin` via `admin_id`. | Update `PlatformAdmin` PK mapping and settings updater relationship/repository; choose admin-user attribution based on v3. |
| Auth tokens | PK `id`; purpose enum has email verification/business email/rider activation/email change only; `token_hash CHAR(64)`. | Migration/model use `token_id`; existing `AuthTokenService` issues a `password_reset` purpose and repository supports it; plan §5.3 requires password reset. | **Schema decision required:** add password-reset token purpose/table support, or approve a separate reset-token design; then update model PK, enum, lookup index and token repository. Do not drop password reset functionality. |
| PSGC hierarchy | `code VARCHAR(12)`, `full_name`, FULLTEXT/name indexes; `parent_code` has no FK constraint in v3. | Current migration/model use code length 10 and no `full_name`; repository returns name/parent only. Plan requires parent hierarchy and Zamboanga cross-level search. | Extend `PsgcLocation`/importer/repository to v3 fields and cross-level search; decide whether to add the missing self-FK and enforce level/parent consistency. |
| Platform settings storage | `value VARCHAR(255)`, nullable `updated_by` FK to `users.id`. | Migration uses JSON value and required `updated_by` FK to `platform_admins.admin_id`; model casts value to array and updater belongs to PlatformAdmin. | Change settings cast/repository/validation and attribution relationship to v3 scalar values/user FK, or resolve required-vs-nullable and JSON-vs-string before implementation. |
| Restaurant category | V3 `restaurants` has no `category` column. | Existing page migration adds `restaurants.category`; `Restaurant` fillable includes it. Customer browse plan uses cuisine/category filters. | Decide whether restaurant category is removed, mapped to `cuisine_types`/`restaurant_cuisines`, or restored in schema. Update page/application/UI and public catalog filters consistently. |
| Restaurant owner design/status/field sizes | Single `owner_user_id`; status enum approved/suspended/inactive/closed; `name` 120, phone 20, business email 190, coords DECIMAL(9,6); radius/prep required defaults. | Plan §4.6 lists Pending/Rejected restaurant statuses plus application statuses; Business schema docs and migration separate application status and `is_published`; existing model/migration use name 160, phone 40, email 254, coords DECIMAL(10,7), nullable radius/prep. | Retain v3 application-vs-restaurant separation per its comments, but align model validation/casts and legacy migration assumptions; decide required/default data handling for nullable existing fields if migrations are ever approved. |
| Audit log | PK `id`; nullable actor for system; nullable bigint `entity_id`; action/entity strings length 60. | Existing migration/model use `log_id`, require actor, use string `entity_id` length 100, and model has no Restaurant relationship. Plan allows audit actor but does not require system events. | Update PK, nullable actor handling, entity identifier type, lengths, policies and repository; add relationships as appropriate. |
| Notifications | PK `id`, type 60/message 255/reference 60. | Foundation migration/model use `notification_id`, type 100, text message, reference 160. | Update primary-key mapping, fillable/casts and notification repositories/resources. |
| Application constraints | V3 adds generated `open_update_key` and `open_initial_key`; `CHECK` for sensitive-update restaurant. | Existing migration only has generated one-open-sensitive-update key; it does not enforce one open initial per submitter. Model has no generated fields. | Update migration/model/repository to match v3 when approved, or record a deliberate DB-enforced constraint strategy. |
| Application document verification | V3 column is `verified`; doc type enum includes four types. | Migration/model use `verification_state` string; existing controller/resource logic uses verification-state vocabulary. | Map to v3 boolean or change schema only after owner decision; update review/admin code and document resources. |
| Restaurant photos | V3 adds `thumb_path`, `medium_path`, path/alt sizes 255/160. | Existing migration/model has no variants and uses alt text length 255. | Update photo model, storage service, upload resource and responsive image API for generated variants. |
| Restaurant staff fields and role | V3 roles are manager/reservation_manager/staff; no `joined_at`; no owner role. | Existing model/migration include `joined_at`; permission map/team model assume synthesized single owner. User's rule requires several owners. | Remove/retain `joined_at` according to v3, and resolve owner representation first; do not encode additional owners as ordinary staff without explicit permission semantics. |
| Invitations | V3 requires `staff_id` FK and generated pending key combining restaurant/email; token hash unique. | Existing invitation migration/model have no `staff_id`, use a generated pending-email field, and link only restaurant/user/inviter. | Add membership relationship and update acceptance/resend/expiry transactions to keep invitation `staff_id`, `restaurant_id`, `user_id` and role consistent. |
| Operating hours and closure | V3 uses `reason VARCHAR(120) NULL`, time checks and no explicit restaurant/day index beyond unique key. | Existing migration/model require reason up to 255; no SQL-level checks in migration. | Adjust FormRequest/Resource/model casts to nullable/120 and verify schedule queries use the v3 key/indexes. |
| Reservation settings | V3 fields are non-null with defaults and no `created_at`. | Existing migration allows nullable settings until configured and includes timestamps; Business service treats incomplete/null policy as disabled. | Decide whether defaults mean reservations are configured or disabled. Adapt service/UI to v3 default semantics and remove reliance on null-as-unconfigured. |
| Menu category/item lengths and indexes | V3 category 80, item 120; category index only unique name; item index `(category_id,lifecycle_status)`; check constraints for price and quantity. | Existing migration/model allow category 120/item 160 and add status/sort index plus availability in item index. | Align validation/resources/query plans with v3 or request a schema change; do not silently truncate existing values. |
| Address fields across surfaces | `user_addresses` has one nullable `psgc_code`, nullable `street`, `house_no`, coordinates and delivery note, `label VARCHAR(40)`, `custom_label VARCHAR(60)`, `address_type ENUM(home,work,church,other)`, and `is_default`. `restaurants` has one nullable `psgc_code`, street and coordinates. `zones` has optional `psgc_code` plus geofence center/radius. `rider_profiles` has only `home_lat/home_lng`. `orders` has `delivery_address_id`, `delivery_address_text VARCHAR(300)`, and delivery coordinates. | C0 address revision requires Country, Province, City/Municipality, Barangay, Street, House number for saved addresses, checkout, restaurant locations, and rider home locations, plus stored formatted text. Country is absent; restaurant/rider locations lack house number/formatted text; saved addresses lack country/formatted text; orders lack country code but already have the approved formatted-text/coordinate snapshot. PSGC schema has region/province/city/barangay levels, no municipality level, and no parent FK. | Owner confirmed: add `country_code="PH"` to saved-address, restaurant, rider-home, and delivery-order snapshot records; persist one barangay leaf PSGC code and derive ancestors; add formatted address to saved/restaurant/rider records; add missing restaurant/rider address fields; keep order snapshot to country code + existing formatted text/coordinates; zones remain geofences. Requiredness/label mapping and current limits were confirmed. Owner edits v3; no SQL or C1 implementation is authorized here. |
| Carts | V3 `carts` unique `(user_id,restaurant_id)` with only `expires_at` and `updated_at`; no state or explicit activity time. | Customer docs now specify one reusable row per pair, clearing items on expiry/checkout; Plan uses `updated_at` and `expires_at` for seven-day inactivity. | Reuse the unique row; define expiry semantics in service and initialize `expires_at`; do not add lifecycle columns. |
| Checkout group/order naming | V3 order FK is `checkout_id`; `orders` has nullable address FK and snapshot text/coords; cancellation actor is split into enum and user ID. | Current migration/model use `checkout_group_id` and `cancelled_by`; Plan §19 uses checkout ID and describes `cancelled_by` without actor type. Previous Customer proposal expected `checkout_group_id`. | Change `Order` model, relationships, repositories, resources, controller/service inputs and Business order API mapping to v3. Preserve snapshot semantics. |
| Order cancellation fields | V3 `cancelled_by_type` supports customer/restaurant/admin/system plus nullable user FK. | Current model/migration use only nullable `cancelled_by` user FK; Business service/system history uses nullable actor for system. | Update cancellation authorization/audit/resource logic to preserve actor type even for system actions, and validate consistency between actor type and nullable user ID. |
| Order totals and items | V3 checks nonnegative totals and positive quantity, but item snapshot price has no check and no DB rule ensures order has at least one item. | Plan requires positive prices/quantities and all-or-nothing snapshots; B5 model/migration has the same general shape but no v3 money checks. | Add service/transaction validation for group/order/item invariants; consider snapshot-price check and delivery/pickup conditional checks. |
| Payment cardinality | V3 has ordinary `KEY idx_pay_order`; no unique `order_id`. | Legacy migration/model enforce unique `order_id` and a `HasOne`; Plan/Customer docs now follow v3's one-to-many allowance. | Change model/API relationship to `HasMany`; retain payment-attempt behavior. Do not add a unique key. |
| Discount first-order representation | V3 `type` includes `first_order`; no `first_order_only` column. | Legacy B7 model/API use `first_order_only`; Plan, Business and Customer docs now use v3's type. | Align future code/model/validation to v3; no duplicate first-order flag. |
| Discount uniqueness/eligibility | V3 generated `scope_key`, unique `(scope_key,code)` under case-insensitive collation; `per_customer_limit` nullable; no generated normalized code. | Legacy B7 migration uses `scope_restaurant_id` plus `normalized_code`; docs specified per-customer default 1. | Align future model/code to v3 `scope_key`; null `per_customer_limit` means no per-customer cap. Preserve v3 case-insensitive uniqueness; normalize/validate code input in service. |
| Discount redemptions | V3 FK/order unique and applied/released states. | Existing B7 proposal/model uses matching table but its `order_id` is unique; Customer doc describes same. | Mostly compatible; verify column/cast/index names and transactional release once checkout exists. |
| Tables/reservations | V3 tables use number 20/area 60 and no explicit status/capacity index; reservation settings defaults; no separate response or late-cancel marker; no reschedule-request state/table. | Business migration/model has longer fields and `response_reason`; Customer docs disable approval-based reschedule requests and late-cancel indicators. | Align validation/resources to v3; enforce only supported reservation states. Customer reschedule requests remain disabled; direct Business edits must be audited. |
| Reservation concurrency and customer limit | V3 has overlap-search indexes, but no exclusion constraint/unique key for overlap and no per-customer active-reservation constraint. | Plan §23 requires locking table row/rechecking overlap and §18 proposes at most three active reservations; Business service uses transaction/locks for availability but customer endpoints are absent. | Enforce in a customer service transaction and test concurrent requests; database schema alone does not guarantee one winner. Enforce three-active limit transactionally. |
| Support-ticket messages | V3 places initial `body` on `support_tickets`; messages require a non-null `user_id` sender. `assigned_admin_id` also references `users`. | Customer docs now map Admin senders/assignees through `platform_admins`; code still needs capability checks. | Use existing schema; authorize Admin senders/assignees by `platform_admins` relation and apply customer/ticket ownership policies. |
| Zones and shifts | V3 defines zones/shifts/capacity and checks, but shift check requires `end_time > start_time`. | Plan §19 matches entities; existing implementation has Admin service stub fixtures but no dedicated zone/shift models/repositories found. | Create models/repositories and determine whether overnight shifts must be supported or prohibited. |
| Rider application/profile | V3 combines application lifecycle (`application_status`) and rider status in `rider_profiles`; status may be null; no separate RiderApplication table. | Plan §19 names RiderProfile and §7.1 describes application; existing Customer-side backend has no rider application controller/model. | Implement against the combined v3 lifecycle only after confirming nullable status state transitions and matching Admin/Driver flow. |
| Rider documents | V3 stores profile photo and ID photo in private `rider_documents`; unique one per type. | Plan §7 says profile/ID photos private, but plan table lists RiderDocument; no model/repository currently exists. | Create model/storage authorization and verify whether profile photos should be private or public at presentation time. |
| Rider assignments | V3 unique `(rider_id,shift_id)`; optional zone for waitlist; nullable Admin actor. | Plan §7 supports waitlist, zone/shift capacity and Admin overrides; no related models/repos found. | Implement assignment lifecycle and capacity-safe transaction/locking around zone_shift_capacities; unique rider/shift assumes one assignment per shift. |
| Deliveries/proof/offers | V3 adds delivery proof path/location and offers. Delivery status can be delivered while proof fields nullable; no offer uniqueness constraint. | Plan §7.3 requires camera photo/timestamp/location; §19 includes Delivery/DeliveryOffer. Existing `BusinessOrderService` stops at Ready; no Delivery model or migration source exists. | Create delivery/offer models and services; enforce proof requirement when delivered and one active offer per policy, with idempotent dispatch. |
| Rider reviews | V3 unique review per delivery. | Plan §15.3/§19 RiderReview matches; current model absent. | Create model/policy/repository with customer ownership and one-review rules. |
| Laravel framework tables | V3 omits framework tables by design. | Existing migration source creates `sessions`, while v3 comment says Laravel creates sessions, personal access tokens, jobs, cache and migrations. | Choose Laravel session/cache/queue/auth drivers and create only the framework tables actually required; do not duplicate v3 application schema. |

## 3. Feature needs not represented or not fully guaranteed by v3

Owner decisions are applied below. Use v3 wherever it represents the feature; do not add schema here. Any requirement that cannot be represented is [VERIFY] and must wait for the owner to edit v3.

1. **Several owners and Owner confirmation — [VERIFY]:** Several Owners per restaurant is required. An Owner cannot transfer ownership but can add another Owner. The Manager ownership-change request feature is removed. V3's single `restaurants.owner_user_id`, staff-role enum and staff-only invitations cannot encode this; owner must update v3 before implementation.
2. **Per-order address snapshots — use existing v3 fields plus approved country column:** use `orders.delivery_address_id`, `delivery_address_text`, `delivery_lat`, `delivery_lng`, `recipient_name` and `recipient_phone`, and add delivery `country_code` per the owner's decision. Formatted text plus coordinates are the complete address snapshot; do not add separate component, PSGC-code, or delivery-note snapshots. Keep snapshots immutable and preserve them independently of later address deletion/anonymization.
3. **Order checkout data — use existing v3 tables/fields:** `checkout_groups`, `orders.order_type`, `discount_redemptions`, `payments` and order snapshots cover the checkout grouping, delivery/pickup type, discount identity and payment choice. Use the `DiscountRedemption` relation to identify the applied discount; do not duplicate code fields on the order.
4. **Delivery proof evidence — use existing fields:** use `deliveries.delivered_at` as the completion/proof timestamp. Require private proof path and valid coordinates in the delivery-completion service; the schema does not enforce these conditional requirements. Additional proof metadata is not added.
5. **Live rider location and route/ETA — cache only:** no location-history table. Keep the location payload/TTL and audience policy in the Driver/API contract; verify the exact cache key/payload before implementation. Route/ETA remains provider-derived and backend-only.
6. **Restaurant search/filtering — derive:** derive rating from `restaurant_reviews` and popularity from order data; do not add stored aggregates. Search/query performance and indexes are a pre-release verification item.
7. **Account preferences/onboarding/avatar — drop persisted schema features:** no avatar or onboarding columns are added. Do not offer persisted avatar upload or onboarding completion; current settings remain session-backed. Profile/auth fields already in v3 remain supported.
8. **Notification delivery/read domain — use existing table and Laravel queue:** `notifications` stores in-app message/read state; email delivery/retries use Laravel Mail/queue and operational logs, not additional schema fields.
9. **Support ticket attribution — use existing v3 tables:** keep Admin as a `users` row with a `platform_admins` relation; authorize assignment and messages by that capability. `ticket_messages.user_id` identifies the sender. No separate Admin sender table.
10. **Reservation reschedule requests — drop pending-approval workflow:** v3 has no request state/history table. Do not expose Customer reschedule requests; cancel and rebook meanwhile. Any direct Business rescheduling must use existing reservation fields and audit before/after values.
11. **Restaurant ownership invitations — [VERIFY]:** adding another Owner remains required but is blocked until the owner updates v3 to represent Owner membership and invitation/acceptance. Use exact-email lookup and explicit acceptance/activation; never add an owner silently. No Manager transfer request or ownership transfer.
12. **Data retention/soft deletion — use existing markers and retain history:** honor v3 `deleted_at` columns; preserve order/reservation/audit history. Define account anonymization/retention through policy and service. Do not assume every v3 table is soft-deletable.
13. **Prices and fee settings — use existing v3 fields:** store scalar string setting values in `platform_settings.value`, use agreed keys/ranges, audit setting updates, and snapshot quote amounts on orders. Complete setting-key/type/seed review before checkout.
14. **Admin application support — use existing audit and application fields:** use `restaurant_applications`/`rider_profiles` review fields for current state and `audit_logs` for decision history. No extra event table.
15. **Revised address design — owner decisions recorded 2026-10-31:** Store country code on saved/restaurant/rider-home addresses and delivery snapshots; store one barangay leaf code and derive ancestors; keep zones as geofences; order snapshots use country code plus existing formatted text/coordinates. Add saved/restaurant/rider formatted text and missing restaurant/rider address columns. Requiredness, labels, and existing limits are confirmed. The owner edits v3; this report makes no SQL change. Provider terms/free limits/privacy and exact Philippine boundary checking remain [VERIFY]. See [CUSTOMER_SIDE.md](./CUSTOMER_SIDE.md).

## 4. Risk and integrity suggestions — decisions

The owner asked me to decide accept/ignore for each suggestion. “Accept” means retain it as an implementation safeguard or a proposed item for the owner's future SQL edit; it does not authorize editing v3, running SQL/migrations, or changing the database.

| # | Decision | Suggestion and disposition |
|---|---|---|
| 1 | **ACCEPT** | Never execute the supplied SQL as-is; it drops/recreates `salo`. This is a mandatory safety constraint. |
| 2 | **ACCEPT** | Recommend a self-FK for PSGC parent consistency, with valid level rules; owner to decide/edit v3. |
| 3 | **ACCEPT** | Multi-owner representation must be resolved in v3 before code/migrations. This is required by the owner's rule. |
| 4 | **ACCEPT** | Enforce exactly one default address in a locked service transaction; validate label/type and Philippine coordinates. No schema edit is made here. |
| 5 | **ACCEPT** | Use `address_type=other` and `label=School`; require a complete valid delivery address/pin in service logic. |
| 6 | **ACCEPT** | Reuse the unique cart row per user/restaurant; touch parent `carts.updated_at` on every item mutation; set `expires_at` to seven days after activity while nonempty; clear items and `expires_at` after expiry/checkout, then reuse the row. |
| 7 | **ACCEPT** | Enforce delivery/pickup, at-least-one-item, positive snapshot price, total arithmetic, and delivered-proof invariants in transactional service logic; owner may decide whether to add DB constraints. |
| 8 | **IGNORE** | Do not add `UNIQUE(payments.order_id)`: v3 allows payment attempts per order. Update the plan/API relationship to one-to-many. |
| 9 | **ACCEPT** | Treat nullable `per_customer_limit` as no per-customer cap; validate `free_delivery` and `first_order` semantics in the quote service. Use v3 `type`, not a duplicate flag. |
| 10 | **ACCEPT** | Verify invitation restaurant/staff/user/role consistency in the invitation transaction; independent FKs alone do not ensure matching membership ownership. |
| 11 | **ACCEPT** | Enforce review customer/order/delivery ownership, eligibility and self-review restrictions in policies/services. |
| 12 | **ACCEPT** | Check Admin capability through `platform_admins`; validate message sender capability; add indexes only after queue/query review. |
| 13 | **ACCEPT** | Require private proof path, valid coordinates and `delivered_at` when delivery completes; enforce in service because v3 fields are nullable. |
| 14 | **ACCEPT** | Make offer creation idempotent and ensure one outstanding offer through transaction/service rules; owner may decide on stronger DB uniqueness. |
| 15 | **ACCEPT** | Review query plans and add indexes only if needed for actual filters/FK access; owner to make any v3 changes. |
| 16 | **ACCEPT** | Verify deployed MySQL is at least 8.0.16 and enforces the v3 CHECK/generated-column features before relying on them. |
| 17 | **ACCEPT** | Validate coordinate, money, discount, capacity, quantity and time bounds in services; owner to decide any additional SQL constraints. |
| 18 | **ACCEPT** | Preserve history and align deletion/anonymization with existing `deleted_at` fields; do not hard-delete history-bearing records. |
| 19 | **ACCEPT** | Verify and seed all required fee, radius, ETA, support, reservation and retention setting keys before enabling dependent features. |

## 5. Laravel models, relationships and repositories

This list is the work needed for the current Laravel source to represent v3. It is an impact inventory, not authorization to change code.

### Existing models to change

| Model | Required alignment to v3 |
|---|---|
| `User` | Use `password_hash` for authentication; add soft-delete handling if intended; add relations to addresses, carts, checkout groups, reservations, reviews, favorites, tickets/messages, rider profile, assignments/notifications; ownership relation must stop assuming one owner scalar if the multi-owner rule is adopted. |
| `PlatformAdmin` | Change PK from `admin_id` to `id`; update User relation and settings/admin references. |
| `AuthToken` | Change PK `token_id` to `id`; purpose enum/schema must retain password reset somehow; adjust casts/lookup attributes. |
| `PsgcLocation` | Add `full_name`, adjust code length, preserve parent/children; ensure importer/repository fill/query it. |
| `PlatformSetting` | Change value cast from JSON array to string/scalar; updater belongs to `User`, not `PlatformAdmin`; update PK unchanged. |
| `Restaurant` | Align lengths/defaults/status and remove `category` unless owner changes v3; add photos/apps/cuisines/hours/closures/categories/orders/discounts/tables/reservations and address/PSGC relationships; represent multiple Owners and Manager requests according to the owner's decision. |
| `AuditLog` | PK `id`; nullable actor/system events; nullable bigint entity ID; add `restaurant()` relationship and retain actor relation. |
| `BusinessNotification` | PK `id` instead of `notification_id`; align field lengths and route/resources. |
| `RestaurantApplication` | Match v3 generated open keys and constraints; review references and status casts. |
| `ApplicationDocument` | Replace `verification_state` with v3 `verified` and align document enum/path metadata. |
| `RestaurantPhoto` | Add `thumb_path`, `medium_path`; align alt-text length and storage/resource relationships. |
| `RestaurantStaff` | Align role/status/timestamp fields; add/replace Owner membership relation only after multi-owner representation is decided. |
| `Invitation` | Add `staff_id`, update generated pending key/schema references, and relationships to membership plus inviter/invitee. |
| `OperatingHour`, `ClosureDate`, `ReservationSetting` | Align nullability, defaults, reason length, and reservation settings timestamps/initial configuration semantics. |
| `MenuCategory`, `MenuItem` | Align field lengths, indexes/casts; keep restaurant derived through category and add price/quantity constraints to validation. |
| `Order` | Rename `checkout_group_id` to `checkout_id`; add `delivery_address_id`; replace `cancelled_by` with `cancelled_by_type`/`cancelled_by_user_id`; add delivery relation; decide payment cardinality. |
| `OrderStatusHistory` | Rename actor field from `actor_user_id` to `changed_by`; align reason/status lengths and ordering. |
| `Discount` | Remove `first_order_only`; v3 represents first-order eligibility with `type='first_order'`. Align generated `scope_key` and code semantics; null `per_customer_limit` means no per-customer cap. |
| `Reservation` | Remove `response_reason` (not in v3); align cancel/respond fields and relations. |
| `RestaurantTable` | Align table/area lengths; indexes and constraints; existing table relation remains. |
| `CheckoutGroup`, `OrderItem`, `Payment`, `DiscountRedemption`, `CuisineType`, `DietaryTag`, `RestaurantApplication` and other largely matching models | Verify PK/FK/column names, timestamps, enum casts and relationships against v3; payment cardinality is specifically unresolved. |

### Models to create

`UserAddress`, `Cart`, `CartItem`, `RestaurantReview`, `FavoriteRestaurant` (or explicit pivot relations), `FavoriteMenuItem` (or explicit pivot relations), `SupportTicket`, `TicketMessage`, `Zone`, `Shift`, `ZoneShiftCapacity` (pivot model if needed), `RiderProfile`, `RiderDocument`, `RiderPreferredShift` (pivot), `RiderShiftAssignment`, `Delivery`, `DeliveryOffer`, `RiderReview`.

Do not create an ownership-request model: Manager ownership-change requests are removed. For several Owners, an owner-association model/pivot and add-Owner invitation relation are [VERIFY] schema decisions for the owner to make before code changes.

### Relationship additions/changes

- `Restaurant`: current `owner(): BelongsTo` only represents one owner. Add the v3-compatible relation(s) for restaurant owners once the ownership schema is decided; retain `staff()` for non-owner roles, plus existing app/menu/order/reservation relations.
- `User`: inverse `restaurants`/owner association, addresses, carts, checkout groups, own orders through groups, reservations, reviews, favorites, tickets/messages, notifications, rider profile/documents/assignments.
- `Invitation`: `staff(): BelongsTo` by `staff_id`, and validate that staff row's restaurant/user/role match invitation fields.
- `PsgcLocation`: `parent`/`children` remain but v3 needs the parent FK and `full_name`.
- `Order`: `address(): BelongsTo`, `cancelledByUser(): BelongsTo`, `deliveries(): HasOne` (unique order), existing group/restaurant/items/history, and `payments(): HasMany`; add discount redemption relation if required.
- `Payment`: `BelongsTo Order`; use `HasMany` because v3 does not make `payments.order_id` unique.
- `RestaurantReview`: order/user relation; `Restaurant` review relation through orders or an explicit restaurant key only if schema is changed.
- `TicketMessage`: `ticket` and `sender` relationships; Admin/customer differentiation via capabilities.
- `Delivery`: order/rider/offer relations; RiderProfile inverse deliveries/offers/reviews.
- Zone/shift capacity, rider preference and assignment relationships as specified by their junction keys.

### Repositories to create or change

**Existing repository implementations needing v3 alignment:** `DatabaseUserRepository`, `DatabaseAuthTokenRepository`, `DatabasePsgcLocationRepository`, `DatabasePlatformSettingsRepository`, `DatabaseAuditLogRepository`, `DatabaseRestaurantApplicationRepository`, `DatabaseApplicationDocumentRepository`, `DatabaseRestaurantPageRepository`, `DatabaseTeamRepository`, `DatabaseMenuRepository`, `DatabaseOrderRepository`, `DatabaseReservationRepository`, `DatabaseBusinessDiscountRepository`, and `DatabaseBusinessReportRepository`. Their contracts, query columns, primary keys, locks, filters, and transactions must match v3—not the unapplied Laravel migration names. `AddressRepository` currently binds to a session-backed in-memory stub; replace it with a database implementation for `user_addresses`. `SessionRepository`/`DatabaseSessionRepository` must be checked against the selected Laravel `sessions` shape and driver.

**Repository contracts/implementations needed for uncovered areas:** public restaurant/catalog/search; durable user addresses; carts/cart items; atomic checkout/pricing and group loading; favorites; restaurant/rider reviews; support tickets/messages; zones/shifts/capacity; rider profiles/documents/preferences/assignments; deliveries/offers/tracking; and add-Owner invitation/membership only after the owner updates v3. No ownership-transfer or Manager ownership-request repository is needed. Several can be grouped into feature repositories following existing layering, but every DB-backed write/query must remain behind repositories.

## 6. Decisions recorded

The owner has decided: v3 remains authoritative and owner-edited; multiple Owners are required but blocked pending v3 support; an Owner cannot transfer ownership but may add another Owner; Manager ownership-change requests are removed. Risk decisions are recorded in Section 4 above. No schema edits, migrations, database operations, code changes, or Phase C1 implementation were performed.*** End Patch
 novitads
