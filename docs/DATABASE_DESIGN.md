# SALO Database Design — Business Phase Proposal

**Status:** Proposed — not approved for migration. This document elaborates Business entities from [SALO_PLAN_v2.md](./SALO_PLAN_v2.md) and [BUSINESS_SIDE.md](./BUSINESS_SIDE.md). It is not a migration or a replacement for the approved plan. No schema should be migrated until the owner approves this design.

**Decisions recorded 2026-10-30:** The owner approved reuse of `restaurant_applications` for sensitive edits (`application_type` plus `proposed_changes`) and creating the initial Restaurant only on application approval (nullable `restaurant_id` for initial drafts). These decisions do not approve the remaining design or authorize migration.

## 1. Database conventions

- MySQL 8, InnoDB, `utf8mb4`; auto-increment integer primary keys. Clients treat identifiers as opaque; authorization, not ID secrecy, provides isolation.
- Public order and reservation reference codes are non-sequential and unique. Do not use sequential IDs as public reference codes.
- Use Laravel timestamps. Store instants in UTC; evaluate restaurant schedules and reservation rules in `Asia/Manila`.
- Foreign keys are restrictive for historical records. Archive/deactivate instead of hard-delete where history or audit references exist.
- Store only generated file paths, never file contents, client filenames, provider URLs, or signed URLs.
- All writes requiring multi-row consistency use database transactions. Row locks are required for stock changes, reservation table overlaps, and uniqueness-sensitive invitation acceptance.
- Use case-insensitive unique email semantics, and unique scoped codes/labels as listed below.
- Proposed JSON is limited to resumable initial-application draft fields, sensitive-update review snapshots (`proposed_changes`), and optional before/after audit values; queryable operational data remains in normalized columns and relations.

## 2. Foundation schema (Phase 0)

**Proposed — not approved for migration.** These foundation entities are required before Business persistence. The repository currently has no application migrations.

| Table | Proposed columns, keys, indexes, and constraints |
|---|---|
| `users` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; normalized lowercase `email VARCHAR(254)` with case-insensitive collation and unique index; password hash; required `first_name`, nullable `middle_name`, required `last_name`, nullable `suffix`, nullable Philippine `mobile`, nullable `birthday`; status (`invited`, `active`, `suspended`, `deactivated`); nullable `email_verified_at`, `last_login_at`; timestamps. Never return the password hash. An invited account may use temporary placeholder names until the invitee supplies their own names during activation. |
| `platform_admins` | `admin_id BIGINT UNSIGNED AUTO_INCREMENT` PK; `user_id` FK to `users.id`, unique; `admin_level`, `status`, `created_at`. |
| `auth_tokens` | `token_id BIGINT UNSIGNED AUTO_INCREMENT` PK; `user_id` FK; purpose (`email_verification`, `business_email`, `rider_activation`, `email_change`, `password_reset`); hashed OTP/reset token; nullable normalized `target_email`; `expires_at`, nullable `used_at`, `attempts`, `created_at`. Lookup indexes on `(user_id, purpose, target_email, used_at, expires_at)` and expiry. Never store raw token. **[PROPOSED]** `target_email` binds business-email and email-change OTPs to their destination address. |
| `psgc_locations` | `code VARCHAR(10)` PK; nullable `parent_code` self-FK; `name`; level (`region`, `province`, `city`, `barangay`); indexes `(parent_code, name)` and `(level, name)`. Preserve official PSGC hierarchy and codes. |
| `platform_settings` | `setting_key VARCHAR(100)` PK; `value` JSON (or text if required by the approved MySQL configuration); `updated_by` FK to `platform_admins.admin_id`; `updated_at`. |
| `audit_logs` | `log_id BIGINT UNSIGNED AUTO_INCREMENT` PK; `actor_user_id` FK to users; nullable `restaurant_id` FK; action, entity type/ID, nullable before/after JSON, `created_at`; indexes `(restaurant_id, created_at)`, `(actor_user_id, created_at)`, `(entity_type, entity_id, created_at)`. Retention 90 days per X1. Whether ownership-transfer events are exempt is an open owner decision; no exemption is assumed. |
| `notifications` | `notification_id BIGINT UNSIGNED AUTO_INCREMENT` PK; `user_id` FK; type, message, nullable `related_reference`, nullable `read_at`, `created_at`; indexes `(user_id, read_at, created_at)` and `(related_reference)`. Used for table-maintenance attention; no maintenance flag column. |

### Laravel authentication and framework tables

| Table | Proposed columns, keys, indexes, and constraints |
|---|---|
| `sessions` | Needed with Laravel's database session driver: `id VARCHAR(255)` PK; nullable indexed `user_id` (FK if compatible with session lifecycle); nullable `ip_address`, nullable `user_agent`, `payload`, indexed `last_activity`. Regenerate session ID on login; cookie remains httpOnly/Secure/SameSite as configured. |
| `personal_access_tokens` | Sanctum bearer-token table is **not required** for the approved first-party cookie/session SPA flow. Include Laravel Sanctum's standard morph-keyed table and unique token hash only if a separately approved token-auth use case needs it. |
| `jobs`, `job_batches`, `failed_jobs` | Add Laravel's standard queue tables only if the database queue driver is selected; use framework-defined primary keys and indexes. |
| `cache`, `cache_locks` | Add Laravel's standard cache tables only if the database cache/lock driver is selected; use framework-defined primary keys and expiration/lock columns. |

Use the installed framework's migration definitions for conditional framework tables after drivers are approved. Do not add a competing `password_reset_tokens` table; `auth_tokens` owns reset and OTP tokens.

Because `restaurants` is introduced after Phase 0, `audit_logs.restaurant_id` is nullable in the foundation design; add its foreign-key constraint in the later migration that creates `restaurants`. Keep its index from the initial audit-log migration.

## 3. Business tables

### Restaurant and onboarding

| Table | Proposed columns and constraints |
|---|---|
| `restaurants` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; required `owner_user_id` FK to users; name, optional `branch_label`, description, **[PROPOSED]** nullable `category VARCHAR(100)` (the restaurant's customer-facing category selected during onboarding; distinct from B4 menu categories), legal name, contact number, business email and verification timestamp; `psgc_code` FK, street, nullable latitude/longitude; logo/cover paths; delivery radius, prep minutes, `is_24_7`; `status` is only `approved`, `suspended`, `inactive`, or `closed`; `is_published` is an independent flag; timestamps. No unique index on `owner_user_id`: one user may own multiple restaurants. Restaurant is created only on application approval; application lifecycle is stored separately. |
| `restaurant_applications` | `id`; nullable `restaurant_id` FK (null for an initial application until approval; required for a sensitive update); `submitted_by` and nullable `reviewed_by` user FKs; `application_type` (`initial`, `sensitive_update`); `status` (`draft`, `submitted`, `under_review`, `needs_revision`, `approved`, `rejected`); nullable `draft_details` JSON for resumable initial wizard fields; nullable `proposed_changes` JSON for sensitive updates; BIR self-declaration; submission/review timestamps; review notes; timestamps. Sensitive-update rows leave live restaurant fields unchanged until approval. Initial approval creates the Restaurant and assigns its Owner, then links the application. |
| `application_documents` | `id`; `application_id` FK; document type (`business_permit`, `dti_sec_registration`, `owner_valid_id`, optional `halal_certificate`); private path; optional expiry date; verification state; timestamps. |
| `restaurant_photos` | `id`; `restaurant_id` FK; generated public path; alt text; sort order; `is_primary`; timestamps. This table is for gallery photos (maximum 10); logo and cover paths live on `restaurants.logo_path` and `restaurants.cover_path`. Enforce the gallery limit in service logic. |
| `restaurant_staff` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `restaurant_id` and `user_id` FKs; `staff_role` (`manager`, `reservation_manager`, `staff`); status (`invited`, `active`, `suspended`, `removed`); joined/updated timestamps. Unique `(restaurant_id, user_id)` including Removed rows. Create this row with status Invited when invited; reactivate the same row when a removed member is re-added. Owner is synthesized from `restaurants.owner_user_id`, never stored here. |
| `ownership_transfer_requests` | **[PROPOSED]** `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `restaurant_id`, `requested_by_user_id`, `proposed_owner_user_id` FKs; status (`pending`, `approved`, `rejected`); nullable `reviewed_by_user_id` FK and `reviewed_at`; nullable `review_note`; generated nullable `pending_restaurant_id` equal to `restaurant_id` only while status is `pending`; timestamps. Unique-index `pending_restaurant_id` to allow one pending request per restaurant; indexes `(restaurant_id, status, created_at)`, `(requested_by_user_id, created_at)`, and `(proposed_owner_user_id, created_at)`. Restrictive FKs preserve the request history. A Manager request targets an Active SALO account other than the current Owner or requester; the target need not be restaurant staff. Lookup is exact-email only and returns minimal identity confirmation; do not expose a directory. The request creates a Notification for the current Owner and does not change ownership until approval. |
| `invitations` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `restaurant_id`, `user_id`, and `invited_by` FKs; normalized `invited_email`; allowed `staff_role`; unique token hash; status (`pending`, `accepted`, `cancelled`, `expired`); `expires_at`, `accepted_at`, timestamps. `user_id` is always known: an unknown email first creates an Invited account. The invitation owns token hash, expiry, and invitation status. Acceptance/activation changes invitation and staff status atomically; expiry/cancel marks invitation Expired/Cancelled and staff Removed. |
| `cuisine_types` | `id`, unique name, `is_filipino`; shared controlled list. |
| `restaurant_cuisines` | Composite PK `(restaurant_id, cuisine_id)` and FKs. |
| `operating_hours` | `id`; `restaurant_id` FK; weekday; `open_time`, `close_time`, `crosses_midnight`; shift order; timestamps. Unique restaurant/weekday/shift-order. Multiple shifts per weekday allowed. |
| `closure_dates` | `id`; `restaurant_id` FK; closure date, reason, timestamps. Unique `(restaurant_id, closure_date)`. |
| `reservation_settings` | `restaurant_id` PK/FK; accepts flag, confirmation mode, review window, slot/dining minutes, minimum lead hours, maximum months ahead, maximum party size, grace minutes, cancellation cutoff. |

### Menu

| Table | Proposed columns and constraints |
|---|---|
| `menu_categories` | `id`; `restaurant_id` FK; name; unsigned sort order; status (`active`, `archived`); timestamps. Unique `(restaurant_id, name)` and index `(restaurant_id, status, sort_order)`. |
| `menu_items` | `id`; `category_id` FK; name, description, decimal(10,2) price > 0, public image path, lifecycle (`draft`, `published`, `archived`), `is_available`, nullable daily quantity and quantity left, prep minutes; timestamps. Index `(category_id, lifecycle_status, is_available)`. Item's restaurant is derived through category. |
| `dietary_tags` | `id`; unique name; **[PROPOSED]** tag type (`dietary`, `allergen`). The initial controlled list includes contains pork, Halal-certified, vegetarian, vegan, and common allergen labels. |
| `menu_item_dietary_tags` | Composite PK `(menu_item_id, dietary_tag_id)` and FKs. |

Order line snapshots must retain item name and unit price after item changes or archive. Daily quantity is nullable for unlimited stock; quantity decrement/reset behavior is transactional and implemented in a later ordering slice.

The menu migration seeds the controlled dietary-tag vocabulary. A Halal certificate is an `application_documents` row of type `halal_certificate` attached to the restaurant's approved initial application; its private path is never returned by the menu API. B4 requires explicit Owner confirmation for every price edit because Customer cart records do not exist yet; affected-cart detection is deferred to the Customer cart implementation.

### Shared order foundation (B5 prerequisite)

**Proposed — documented for B5 implementation; migration remains unrun.** These are the shared order records required by Business order management. Customer checkout remains out of scope; B5 must not create parallel Business order records or customer-facing checkout routes.

| Table | Proposed columns, keys, indexes, and constraints |
|---|---|
| `checkout_groups` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `user_id` FK to users; unique non-sequential `reference_code`; nullable `idempotency_key`; `placed_at`; timestamps. Unique `(user_id, idempotency_key)`; group total is derived from its orders. |
| `orders` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `checkout_group_id` FK; `restaurant_id` FK; unique non-sequential `reference_code`; `order_type` (`delivery`, `pick_up`); nullable `scheduled_for`; `status` (`placed`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `completed`, `rejected`, `cancelled`, `delivery_failed`); recipient name/phone and delivery address text/coordinates snapshots; subtotal, delivery fee, service fee, discount amount, and total amount as `DECIMAL(10,2)` snapshots; nullable `cancelled_by` user FK, cancel reason, `placed_at`, `completed_at`, customer confirmation timestamp/method; timestamps. Indexes `(restaurant_id, status, placed_at)` and `(checkout_group_id, status)`. Do not add `user_id`; customer is derived from `checkout_groups`. |
| `order_items` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `order_id` FK; `item_id` FK to `menu_items`; item name and unit-price snapshots; positive quantity; nullable note; timestamps. Index `(order_id)`; restrict deletion so order history is preserved. |
| `order_status_histories` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `order_id` FK; nullable `actor_user_id` FK (NULL means system); nullable `from_status`; `to_status`; nullable reason; `changed_at`; index `(order_id, changed_at)`. |
| `payments` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; unique `order_id` FK; method, status, amount snapshot, nullable provider/reference, nullable `paid_at`; timestamps. First-build methods are Cash on Delivery and pay-at-pick-up; no online-payment credentials are stored. |

`delivery_address_id` is intentionally omitted until persisted Customer addresses exist; the order keeps the required address text and coordinate snapshots. B5 cancellation restores the ordered menu quantities in the same transaction. Discount redemption release cannot be exercised until the shared discount/redemption records and Customer checkout exist; B5 creates no checkout or redemption rows. The order service must be extended to release a redemption in the cancellation transaction when that dependency is implemented.

### Tables, reservations, discounts

| Table | Proposed columns and constraints |
|---|---|
| `restaurant_tables` | `id`; `restaurant_id` FK; `table_number`; positive capacity; area; status (`active`, `maintenance`, `inactive`); timestamps. Unique `(restaurant_id, table_number)`. |
| `reservations` | `id BIGINT UNSIGNED AUTO_INCREMENT` PK; `user_id` and `table_id` FKs; public non-sequential unique reference code; `start_at`; `duration_minutes`; guest count; guest name/phone snapshot; special request; status (`pending`, `confirmed`, `declined`, `expired`, `cancelled`, `completed`, `no_show`); expiry; responder/canceller user FKs and reason; timestamps. Do not store a separate end timestamp or restaurant ID; derive end time as `start_at + duration_minutes` and restaurant through the table. |
| `discounts` | `id` PK; nullable `restaurant_id` FK (null means platform scope; Business-created rows always reference a restaurant); `created_by` FK; `funded_by` (`restaurant` for this phase); code, name, description, type (`percentage`, `fixed`, `free_delivery`, `first_order`), value, minimum, maximum discount, start/end timestamps, total/per-customer limits, active flag; timestamps. |
| `discount_redemptions` | `id`; discount/order/user FKs; applied amount; status (`applied`, `released`); timestamps. Unique order constraint. Usage counts are derived from active redemptions. |

The `orders`, `order_items`, and `order_status_histories` schema is a Customer/Ordering dependency as defined in the approved plan. Business order management must use those same tables; it must not create parallel Business order records. In particular, do not add `orders.user_id`; customer is derived through the checkout group. `order_status_histories.actor_user_id` is nullable; null means the system performed the transition, such as a 10-minute automatic cancellation.

### Durable audit history

`audit_logs` is a foundation table reused by Business. Each event includes actor, restaurant scope, action, entity type/ID, before/after values, and timestamp. Restaurant Owners read their own restaurant history. Admin reads through the Admin namespace in Phase 1; this does not add an Admin route to the Business namespace. Audit retention is 90 days. Whether `ownership.transfer` events are exempt from purge is an open owner decision.

When a table changes to Maintenance, create a Notification for the restaurant. Derive the needs-attention list by querying future active reservations on tables whose status is not Active; do not add a flag column to reservations or tables.

## 4. Relationships and indexes

- User `1:M` restaurants via `owner_user_id`; Restaurant `1:M` applications, photos, staff, invitations, hours, closures, categories, tables, and discounts.
- Ownership-transfer requests belong to one restaurant and reference the Manager who requested the transfer, the proposed new Owner, and (after review) the current Owner who approved or rejected it.
- Restaurant `M:N` cuisine types via `restaurant_cuisines`; Menu item `M:N` dietary tags via `menu_item_dietary_tags`.
- Menu item belongs to a category; category belongs to a restaurant. Do not duplicate restaurant ID on items.
- Reservation belongs to a user and restaurant table; restaurant is derived through table.
- Application documents belong to an application; an application belongs to a restaurant.
- Index restaurant/status/date columns used by queues, hours, closures, reservations, discounts, and audit history. Add `(restaurant_id, status)` where applicable, `(restaurant_id, weekday)`, `(restaurant_id, closure_date)`, `(table_id, start_at, status)`, and `(restaurant_id, created_at)` where those fields exist.
- Reservation overlap uses `start_at < :new_end AND start_at + INTERVAL duration_minutes MINUTE > :new_start`; check only unexpired Pending holds and Confirmed reservations. The `(table_id, start_at, status)` index supports the search. Do not store a separate end timestamp; reservations has no restaurant column.
- Unique constraints: case-insensitive user email; `(restaurant_id,user_id)` staff; `(restaurant_id,table_number)`; `(restaurant_id,name)` category; `(restaurant_id,weekday,shift_order)` hours; `(restaurant_id,closure_date)`; `(order_id)` redemption; and unique non-sequential order/reservation reference codes.
- `restaurant_applications`: **[PROPOSED]** MySQL has no partial unique indexes. Add a generated nullable column equal to `restaurant_id` only for `sensitive_update` rows in active workflow statuses (`draft`, `submitted`, `under_review`, `needs_revision`), otherwise `NULL`; unique-index it to allow at most one pending sensitive update per restaurant.
- `invitations`: **[PROPOSED]** Add generated nullable `pending_invited_email`, equal to normalized `invited_email` only while status is `pending`, otherwise `NULL`; unique-index `(restaurant_id, pending_invited_email)`. MySQL unique indexes permit multiple `NULL` values.
- `discounts`: **[PROPOSED]** Add generated scope `COALESCE(restaurant_id, 0)` (0 means platform scope) and generated normalized code; unique-index `(scope_restaurant_id, normalized_code)` for scoped code uniqueness.
- Do not add a unique index on `restaurants.owner_user_id`.

## 5. Integrity and transaction requirements

1. Invitation issue: create/locate the account, create or reactivate the unique staff row as Invited, and create invitation with hashed token in one transaction. Resend rotates token and expiry. Acceptance/activation locks the invitation, checks expiry/single-use/email match/restaurant status, activates the account if needed, activates the staff row, and accepts the invitation atomically. Expiry/cancel marks invitation Expired/Cancelled and staff Removed atomically.
2. **[PROPOSED] Ownership transfer:** Owner-initiated transfer validates the Owner's password and explicit confirmation. Manager-initiated transfer validates that the requester is an Active Manager and no other request is pending for the restaurant; it creates a request and notifies the current Owner but changes no membership, permissions, or ownership. Approval revalidates the current Owner and proposed target account, then atomically marks the request approved, updates `restaurants.owner_user_id`, sets or creates the new Owner's `restaurant_staff` row as Removed, creates or reactivates the former Owner's row as Manager, and records the before/after audit. Rejection changes only the request/review fields and writes the rejection audit. One pending request per restaurant is enforced by the generated nullable unique column. Reuse the unique staff row if a removed member is re-added or ownership moves back. `/auth/me` synthesizes Owner membership from `owner_user_id`.
3. Sensitive restaurant update: create an application/review record without changing live fields. On admin approval, apply only allowlisted proposed values and write before/after audit in one transaction.
4. Table maintenance: update table status and create a Notification for the restaurant. Derive attention-needed reservations from future active reservations on tables whose status is not Active; do not persist a separate flag.
5. Reservation create/reschedule: lock table row, validate capacity and status, check hours/closure/overlap, then create/update within the same transaction using the overlap predicate in Section 4.
6. Menu quantity reset and order status actions: lock the item/order rows, enforce lifecycle and stock invariants, persist history, and release stock/discount use for cancelled/rejected orders in the same transaction.
7. Restaurant suspension: block all restaurant-role writes, including finishing in-flight orders. Admin cancels or resolves in-flight orders and reservations with a reason. Closing is not suspension and does not make the restaurant blanket read-only.
8. Every database-backed business endpoint uses repositories; controllers do not access Eloquent or issue raw queries.

## 6. Proposed operational rules

- **[PROPOSED] Daily quantity reset:** reset at the first operating shift's opening time for that weekday. An Open 24/7 restaurant resets at midnight in `Asia/Manila`. The job is idempotent and preserves unlimited quantities.
- Invitation expiry is 72 hours; audit retention is 90 days; rejected-application documents are subject to the 30-day retention in plan X1 and legal/privacy review.
- File tables store paths only. Public restaurant/menu photos use the public disk; permits and IDs use the private disk and authorized short-lived access.

## 7. Items requiring approval or verification

- The sensitive-edit table strategy and initial-application lifecycle above are approved design decisions; their final field-level migration review remains part of approval of the complete schema.
- **[PROPOSED]** Generated columns enforce pending invitation and pending sensitive-update uniqueness in MySQL 8.
- **[PROPOSED]** `ownership_transfer_requests` persists Manager proposals and uses a generated nullable restaurant ID to enforce one pending request per restaurant. This table and its request/review endpoints are not approved for migration or implementation yet.
- **[PROPOSED]** Discount-code uniqueness uses generated `COALESCE(restaurant_id, 0)` scope and normalized code.
- **[PROPOSED]** OTP records include nullable normalized `target_email`.
- **[PROPOSED]** Daily quantity reset uses first shift opening, or Manila midnight for Open 24/7.
- Decide whether `ownership.transfer` events are exempt from the 90-day purge. No exemption is applied in this design.
- Confirm exact MySQL 8 collation and Laravel session, queue, and cache drivers before migration generation.
- Confirm privacy/legal retention requirements for IDs, permits, audit logs, and deleted upload files; listed durations remain subject to the source plan's `[VERIFY]` items.
- **Proposed plan edit (not applied):** SALO_PLAN_v2.md Section 4.6 should list Restaurant statuses as Approved, Suspended, Inactive, and Closed, with publication represented by separate `is_published`. Pending and Rejected belong to RestaurantApplication status. The approved plan was not edited.
- No migration or destructive schema change may be produced until the owner approves this design.
