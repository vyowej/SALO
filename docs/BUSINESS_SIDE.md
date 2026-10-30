# SALO Business Side

**Status:** B0 documentation and B1 onboarding are complete; B1 was hand-tested by the owner. B2-B5 implementation code is present, but backend tests and migration execution await a compatible PHP runtime; B2-B5 also await hand-testing. This document records the Business contract and database proposal; see `DATABASE_DESIGN.md` for the current schema design. [SALO_PLAN_v2.md](./SALO_PLAN_v2.md) is authoritative if requirements conflict.

## 1. B0 prerequisite audit

This audit is based on the checked-in Laravel code, React code, routes, tests, migrations, and database directory on 2026-10-30. It describes repository implementation, not production readiness.

| Prerequisite | Status | Evidence / gap |
|---|---|---|
| Login | Implemented | Login uses the database-backed user repository, Laravel session authentication, and rate limiting. |
| Email OTP | Implemented | OTPs are hashed, purpose/target-email scoped, single-use, time-limited, attempt-limited, and rate-limited in the database-backed token service. |
| Modes and `/me` | Implemented | Active mode and selected restaurant are session-backed and server-checked; `/auth/me` returns current memberships and permissions. |
| `PermissionMap` | Implemented | `backend/app/Http/Authorization/PermissionMap.php` is the permission source; memberships expose `permissions[]` and the frontend has `useCan`. |
| Membership on every request | Implemented for the current Business surface | Restaurant middleware resolves the route restaurant, selected context, active membership, permission, and suspended read-only state on each request. |
| Audit log | Foundation, B2 event writes, and B3 Owner read endpoint implemented; runtime verification pending | The durable `audit_logs` table and repository exist. B2 records profile, sensitive proposal, photo, hours/closure, and publication/closure changes; B3 adds searchable, paginated Owner-only history and 90-day retention. |
| PSGC data | Partial | A database-backed PSGC endpoint and import command exist. No official data file is checked in, so a complete official import is not confirmed. |
| Local-disk storage | Implemented | Explicit public/private disks, upload services, generated names and photo metadata removal, plus authorized short-lived private-document links exist. |
| Platform settings | Implemented | Settings are persisted through the database repository and settings table. |
| Admin application queue | Implemented | Applications are database-backed; Admin review supports start-review, approve, reject, and request-revision. |
| Database design and migrations | B0/B1 migrations exist; B2-B5 migrations written, not run | B2 page tables, B3 invitations, B4 menu tables, and B5 shared order tables match the documented proposal; no B2-B5 migrations were executed. |
| Business backend and UI | B1 hand-tested; B2-B5 implemented, runtime verification pending | B2 page editor, B3 team and audit, B4 menu management, and B5 orders are implemented. Backend tests are blocked by the local PHP version; B2-B5 need compatible-runtime tests and hand-testing. |

### Remaining verification

The B0 foundation and B1 application workflow are implemented. Added B1 application/document isolation and idempotent-approval tests remain unexecuted because the available PHP CLI is 8.0.30, while installed Composer dependencies require PHP >=8.4.1. The official PSGC hierarchy still needs import/verification. B2-B5 tests and migration execution also await a compatible PHP runtime.

## 2. Contract conventions

- Business management routes use `/api/v1/manage/restaurants/{restaurant}/...`, leaving `/api/v1/restaurants/...` available for customer-facing restaurant routes. Application routes are the exception because an unapproved application has no approved restaurant context: they use `/api/v1/applications/restaurants/...`. Admin review stays under the `/api/v1/admin/applications/...` namespace.
- All routes require Sanctum authentication except `POST /api/v1/team-invitations/{token}/activate`, which is token-gated, rate-limited, single-use, and only lets a new invitee set their own password. Existing-account acceptance uses `POST /api/v1/team-invitations/{token}/accept` and requires authentication plus invited-email match.
- Every restaurant-scoped request resolves that route's restaurant and checks current membership and permission. Nested IDs must belong to that restaurant. UI guards are not authorization.
- A suspended restaurant is read-only for every restaurant role, including in-flight order completion. Admin resolves or cancels in-flight orders and reservations with a reason through the Admin phase. A Closed restaurant blocks new orders and reservations but is not blanket read-only; completing existing operations follows normal permissions. Owner closes; Admin suspends and reinstates.
- JSON uses `snake_case`; timestamps are ISO-8601 with offsets; dates use `YYYY-MM-DD`; time-of-day uses `HH:MM` in `Asia/Manila`. Money is decimal PHP pesos. IDs are auto-increment integers internally; clients must treat IDs as opaque. Authorization, not ID secrecy, provides isolation. Public order and reservation reference codes are non-sequential.
- Success uses `{ "data": ... }`; paginated lists add `{ "meta": { "current_page": 1, "per_page": 15, "total": 0, "last_page": 1 } }`. Errors use the existing Laravel JSON validation shape with stable `message` and `errors` fields. Delete/archive returns `204` unless the route is an explicit state action.
- Reads and writes go through FormRequests, thin controllers, services/actions, repositories, policies, and API Resources. No controller fixture payload is part of the production contract.
- `restaurant_id` is not accepted as a substitute for the route's `{restaurant}`. The backend derives the actor's current permissions; clients cannot submit permissions or roles outside the allowed Owner-managed invitation flow.

## 3. Permission map contract

The keys below are the proposed stable identifiers for the single `PermissionMap`. The implementation must not reproduce grants in controllers or client-side role-name checks.

| Permission | Owner | Manager | Reservation Manager | Staff |
|---|---:|---:|---:|---:|
| `restaurant.view` | Yes | Yes | Yes | Yes |
| `restaurant.page.edit` | Yes | Yes | No | No |
| `restaurant.sensitive.edit` | Yes | No | No | No |
| `restaurant.publish` | Yes | No | No | No |
| `restaurant.photos.manage` | Yes | Yes | No | No |
| `restaurant.hours.manage` | Yes | Yes | No | No |
| `restaurant.menu.manage` | Yes | Yes | No | No |
| `menu.availability.manage` | Yes | Yes | No | Yes |
| `orders.view` | Yes | Yes | No | Yes |
| `orders.status.update` | Yes | Yes | No | Yes |
| `orders.cancel` | Yes | Yes | No | No |
| `reservations.view` | Yes | Yes | Yes | No |
| `reservations.manage` | Yes | Yes | Yes | No |
| `tables.manage` | Yes | Yes | Yes | No |
| `discounts.manage` | Yes | Yes | No | No |
| `reports.sales_reservations.view` | Yes | Yes | No | No |
| `reports.reservations.view` | Yes | Yes | Yes | No |
| `team.view` | Yes | Yes | No | No |
| `team.manage` | Yes | No | No | No |
| `audit.view` | Yes | No | No | No |

Managers may see the team list, but only the Owner receives management actions. Owner audit history is not inherited by managers. A suspended restaurant is read-only for all memberships. Restaurant membership never grants platform capability.

The Owner membership shown by `/auth/me` and Team is synthesized from `restaurants.owner_user_id`; Owners do not have a duplicate `restaurant_staff` row. The Owner reads their restaurant history through the Business audit route. Admin reads through the Admin namespace in Phase 1; no duplicate Admin route is added to the Business namespace.

## 4. Business workflows

### B1 â€” Restaurant application and workspace shell

1. A signed-in Customer starts or resumes one restaurant application from Customer mode. A Business-mode user is directed to Customer mode before starting.
2. The five-step wizard saves a Draft between steps: About; Location and hours; Documents; Photos; Review and submit. Business email verification is a distinct OTP purpose.
3. Location uses PSGC hierarchy/search and a pin; hours are weekly shifts or Open 24/7. Enforce at least four open hours per day and five days per week unless 24/7.
4. Validate three required document types (business/mayor's permit, DTI/SEC registration, owner's valid ID), photo/PDF, at most 2 MB, using actual file type. Store only paths in the database on the private disk.
5. Submit changes the application to Submitted. Admin moves it to Under Review and may approve, reject, or request revision with notes. Applicant can fix and resubmit.
6. On approval, create the restaurant from the validated application and assign exactly one Owner to that restaurant. A user may own multiple restaurants. Approval does not publish it. The Owner sees the Business mode and restaurant switcher. A setup checklist links to required page, hours, menu, tables, and publish actions.
7. Dashboard shows today's permitted operations. The development-only simulated-order control is unavailable outside a local environment.

### B2 â€” Page editor, photos, and hours

- Owner and Manager edit normal page fields, cuisine/category associations, contact, photos, hours, and closures. Only Owner edits legal name, address, and permit details; these edits become a proposed sensitive update and do not replace the live values until admin approval.
- Photos are browser-compressed, server-validated JPG/PNG/WebP with EXIF removed and generated names; store on the public disk. Generate thumbnail/medium variants, track upload progress, and remove replaced files safely. Gallery limit is ten; support alt text, ordering, and primary selection.
- Weekly hours support one or more shifts and overnight flags. `is_open_now` is derived using `Asia/Manila`. Open 24/7 bypasses ordinary-hours checks.
- Publish, unpublish, or close is Owner-only and confirmed. Publishing requires Approved status, pinned address, hours or 24/7, a category, and at least one published/orderable item. Halal badge requires a certificate.

### B3 â€” Team and hierarchy

- Team page displays Owner > Manager > Reservation Manager and Staff, position descriptions, current holders, and a permission preview.
- Owner and Manager can read members; Managers see masked emails and no management actions. Only Owner invites, changes position, suspends/reactivates, removes, and transfers ownership.
- Owner enters an exact email only. Existing account lookup returns only the minimal confirmation identity and requires the invitee's acceptance. A new email creates an Invited account. At invitation time, create the `restaurant_staff` row with status Invited; the `invitations` row owns the token hash, expiry, and invitation status. Never accept a password from the Owner.
- Existing invitees accept through an authenticated, email-matched endpoint. New invitees use the unauthenticated, token-gated activation endpoint to set their own password; it is rate-limited and single-use. Acceptance/activation changes the invitation to Accepted, the Invited account to Active when applicable, and the staff row to Active atomically. Expiry or cancellation changes the invitation to Expired/Cancelled and the staff row to Removed. Resending a pending invitation updates its expiry and token.
- Invitation links expire after 72 hours; resend and cancel are available. Rate-limit lookup at 10/minute/owner and audit checks/invitations. This exact-email feature intentionally reveals limited account existence to a restaurant Owner; do not expose a directory or broader search.
- One `restaurant_staff` row per user per restaurant, including Removed rows, which are reactivated rather than duplicated on re-invitation. Role changes/removal affect the next API request. Staff cannot self-escalate; no one can edit the Owner; the final Owner cannot leave without transfer. Ownership transfer requires current password and an Active Manager; `restaurants.owner_user_id` changes to the target, the target's staff row becomes Removed, and the previous Owner's existing row is created or reactivated as Manager in one transaction. A user may own multiple restaurants.
- Only Owner can read searchable/filterable audit history. Audit retention is 90 days.

### B4 â€” Menu

- Owner/Manager create, edit, reorder, publish, and archive categories/items. Staff may only toggle availability.
- Item lifecycle (Draft/Published/Archived), manual availability, and optional daily quantity remain independent. Orderable means Published, available, and unlimited or quantity left above zero. Archive instead of hard delete; preserve order snapshots.
- Validate positive two-decimal price, one restaurant per category/item, category name uniqueness within restaurant, dietary tags, and upload rules. Halal-certified tags require a valid uploaded certificate stored privately. Daily quantity resets at the first shift opening, or Manila midnight for Open 24/7.
- Until Customer carts exist, require explicit confirmation on every price change and tell the Owner cart impact cannot yet be counted. Actual affected-cart detection belongs with the Customer cart implementation; do not report a fabricated count.

### B5 â€” Orders

- Business views only seeded examples until Customer checkout exists. Any local simulation endpoint/button is development-only.
- Order board polls every 10-15 seconds. Display status, delivery/pick-up mode, item/price snapshots, and activity. Owner alone sees the actor who approved/updated.
- Enforce `Placed -> Confirmed -> Preparing -> Ready`; Delivery continues through Out for Delivery and Delivered, then Completed; Pick-up ends with Mark collected/Completed. Reject/cancel requires a reason. Placed with no response for 10 minutes auto-cancels.
- Cancel/reject returns stock and releases discount redemption. Delivery assignment remains a read-only â€œWaiting for riderâ€ state until Driver phase.

### B6 â€” Tables and reservations

- Owner/Manager/Reservation Manager manage tables and reservations; Staff has no reservation/table permissions. Table number is unique in its restaurant; capacity is positive; stored status is Active, Maintenance, or Inactive.
- Reservation settings include enablement, manual/automatic confirmation (default manual), review window, slot interval, dining duration, lead time, months ahead, party size, grace period, and cancellation cutoff.
- Availability filters Active capacity-fitting tables with no overlapping reservation and checks restaurant hours/closures or 24/7. Booking locks the selected table row and checks overlap in the same transaction. Changing a table to Maintenance sends a Notification to the restaurant; the needs-attention list is derived from future active reservations on tables whose status is not Active.
- Calendar supports day/week/month, confirm, decline, reschedule after availability check, cancel with reason, and No Show after grace period. Pending holds expire after the configured review window.

### B7 â€” Discounts, reports, and calendar

- Restaurant discounts are restaurant-funded. Types: percentage, fixed, free delivery, first order. Validate dates, minimum amount, maximum, total/per-customer limits, and active state. Redemption counts are derived. Apply the plan's documented validation messages; never trust client-computed amounts.
- Reports support date range and CSV: sales summary, orders by status, popular items, discount use, reservations, and no-show rate. Reservation Manager receives reservation-only reports. Owner and Manager receive sales and reservation reports.
- Combined calendar displays operating hours, closure dates, and reservations. FullCalendar is the UI calendar component.
- Admin reads audit history through the Admin namespace in Phase 1; the Business audit route is for the restaurant Owner only.
- An Admin-phase requirement: suspending a restaurant makes every restaurant role read-only, including for finishing in-flight orders. Admin cancels or resolves in-flight orders and reservations with a reason. Closing a restaurant is not suspension and does not make it blanket read-only.

## 5. Business API route registry

`Permission` is checked by a Policy on every route, in addition to fresh restaurant membership resolution. `Owner` and `Manager` below mean the specified permission grants in the map above, not account-wide roles.

### Application and admin-review endpoints (outside restaurant context)

| Method and URL | Request | Response | Required permission |
|---|---|---|---|
| `POST /api/v1/applications/restaurants` | Initial wizard fields | Draft application resource | Authenticated Customer mode |
| `GET /api/v1/applications/restaurants/mine` | Pagination/status filters | Applicant's application list | Authenticated applicant |
| `GET /api/v1/applications/restaurants/{application}` | â€” | Own application and review notes | Authenticated applicant; owner policy |
| `PATCH /api/v1/applications/restaurants/{application}` | Allowed draft/revision fields | Updated application | Authenticated applicant; editable state |
| `POST /api/v1/applications/restaurants/{application}/business-email/otp` | â€” | Generic sent response | Application owner |
| `POST /api/v1/applications/restaurants/{application}/business-email/verify` | Six-digit `code` | Verification state | Application owner |
| `POST /api/v1/applications/restaurants/{application}/documents` | Multipart file, `doc_type`, optional `expiry_date` | Private document metadata, never a path | Application owner |
| `DELETE /api/v1/applications/restaurants/{application}/documents/{document}` | â€” | 204 | Application owner; editable state |
| `POST /api/v1/applications/restaurants/{application}/photos` | Multipart public logo/cover image | Public photo metadata | Application owner |
| `POST /api/v1/applications/restaurants/{application}/submit` | Confirmation and declarations | Submitted application | Application owner; all steps valid |
| `GET /api/v1/admin/applications` | `type=restaurant`, status/pagination | Paginated queue | Admin |
| `GET /api/v1/admin/applications/{type}/{application}` | â€” | Application and authorized document links | Admin |
| `POST /api/v1/admin/applications/{type}/{application}/approve` | Optional `note`; `type=restaurant` | Approved application; initial approval sets restaurant Approved/unpublished and assigns Owner; update approval applies proposed fields | Admin |
| `POST /api/v1/admin/applications/{type}/{application}/reject` | Required `note` | Rejected application; live restaurant fields remain unchanged | Admin |
| `POST /api/v1/admin/applications/{type}/{application}/request-revision` | Required `note` | `needs_revision` application with notes visible to applicant | Admin |

The Admin `restaurant` application queue includes both initial and sensitive-update applications. Sensitive-update approval applies the proposed live fields and writes the before/after audit record in the same transaction.

### Restaurant context and page

| Method and URL | Request | Response | Required permission |
|---|---|---|---|
| `GET /api/v1/manage/restaurants/{restaurant}/business` | â€” | Restaurant profile, membership role, `permissions[]`, suspended/read-only flag | `restaurant.view` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/business/profile` | Editable normal page fields | Updated profile | `restaurant.page.edit` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/business/sensitive-profile` | Legal name/address/permit proposal | Pending change request; live values unchanged | `restaurant.sensitive.edit` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/preview` | â€” | Customer-visible restaurant resource | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/publish` | â€” | Updated publish state/checklist errors | `restaurant.publish` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/publish-checklist` | â€” | Current publish checks, including the orderable-item check | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/unpublish` | Confirmation | Updated publish state | `restaurant.publish` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/close` | `closed`, optional reason | Updated operational state | `restaurant.publish` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/photos` | â€” | Ordered photo list | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/photos` | Multipart `file`, `thumbnail`, `medium`, `kind`, `alt_text` | Photo resource with public URL | `restaurant.photos.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/business/photos/{photo}` | `alt_text`, `sort_order`, `is_primary` | Updated photo | `restaurant.photos.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/business/photos/{photo}` | Confirmation | 204 | `restaurant.photos.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/hours` | â€” | Weekly shifts, overnight flags, 24/7 state | `restaurant.view` |
| `PUT /api/v1/manage/restaurants/{restaurant}/business/hours` | Complete weekly shift schedule or `is_24_7` | Updated hours | `restaurant.hours.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/closures` | Date range | Closure list | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/closures` | `closure_date`, `reason` | Closure resource | `restaurant.hours.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/business/closures/{closure}` | Confirmation | 204 | `restaurant.hours.manage` |

B2 frontend includes the profile editor, Owner-only sensitive proposal, compressed photo manager, weekly-shift editor, FullCalendar closure view, and publish checklist. B4 now checks the real menu data for a published, orderable item; publishing remains blocked until every checklist item is satisfied.

### Team and owner audit

| Method and URL | Request | Response | Required permission |
|---|---|---|---|
| `GET /api/v1/manage/restaurants/{restaurant}/team` | Search, role/status filters, pagination | Members with masked email for Manager; pending invitations | `team.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/team/email-check` | Exact `email` | Minimal match confirmation or no-account state | Owner-only `team.manage`; 10/minute |
| `POST /api/v1/manage/restaurants/{restaurant}/team/invitations` | Normalized exact `email`, `position`, optional `invitee_name` | Invitation status and expiry; `invite_path` only in local environment | `team.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/team/invitations/{invitation}/resend` | â€” | Updated expiry/delivery state | `team.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/team/invitations/{invitation}` | Confirmation | 204 | `team.manage` |
| `POST /api/v1/team-invitations/{token}/accept` | No body; authenticated existing account with matching email | Active membership and permissions | Existing invitee; valid unused token |
| `POST /api/v1/team-invitations/{token}/activate` | Unauthenticated `first_name`, `last_name`, `password`, `password_confirmation`; token in URL | Active invited account and membership | New invitee; rate-limited, valid unexpired single-use token |
| `PATCH /api/v1/manage/restaurants/{restaurant}/team/{membership}` | `position` or `status` | Updated membership | `team.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/team/{membership}` | Confirmation | Removed membership | `team.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/team/transfer-ownership` | `manager_id` (active Manager user ID), current `password` | New Owner; prior Owner becomes Manager | `team.manage` (Owner only) |
| `GET /api/v1/manage/restaurants/{restaurant}/audit` | Search/action/date/page filters | Paginated before/after audit records | `audit.view` (Owner only) |
| `POST /api/v1/admin/restaurants/{restaurant}/transfer-ownership` | Active Manager `manager_id`, required `reason` | New Owner; prior Owner becomes Manager | Admin capability |

The Team response includes `positions` with permission previews and an `assignable` flag, `position_holders`, paginated `members` with a server-computed `can_manage_member` flag, pending `invitations`, and `can_manage`. Member filters are `search`, `position`, `status`, `page`, and `per_page`; Managers' search matches names only so masked emails cannot be inferred. Email-check and invitation audit entries store a one-way email hash rather than the searched address. A new account is created in `invited` state with temporary placeholder name values because the user schema requires names; the invitee replaces them with their own first and last names during activation. The Owner never sets or receives a password. Activation is not available to authenticated sessions; an already-active account must authenticate and use the acceptance endpoint. The exact-email existence check intentionally reveals limited account existence to an Owner; no directory or broader search is exposed.

The Admin ownership-reassignment endpoint is in the Admin namespace and is not a Business route. Ownership-transfer events are included in the normal 90-day audit purge; whether to exempt them remains an owner decision.

### Menu and order endpoints

| Method and URL | Request | Response | Required permission |
|---|---|---|---|
| `GET /api/v1/manage/restaurants/{restaurant}/menu` | Category/search/status filters | Categories and items | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/menu/categories` | `name`, optional `sort_order` | Category resource | `restaurant.menu.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/menu/categories/{category}` | `name`, `sort_order`, `status` (`active`, `archived`) | Updated category | `restaurant.menu.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/menu/categories/{category}` | Confirmation | Archived category | `restaurant.menu.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/menu/items` | Category, name, description, positive price, lifecycle, tags, quantity | Item resource | `restaurant.menu.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/menu/items/{item}` | Allowed item fields; `price_change_acknowledged` on any actual price change | Updated item | `restaurant.menu.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/menu/items/{item}/photo` | Multipart JPG/PNG/WebP image | Item with public photo URL | `restaurant.menu.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/menu/halal-certificate` | Private certificate file, optional expiry date | Certificate availability | `restaurant.menu.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/menu/items/{item}` | Confirmation | Archived item | `restaurant.menu.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/menu/items/bulk-publish` | `item_ids[]` | Updated items and validation failures | `restaurant.menu.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/menu/items/{item}/availability` | `is_available` | Updated availability | `menu.availability.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/orders` | Status/date/page filters | Paginated orders and allowed actions | `orders.view` |
| `GET /api/v1/manage/restaurants/{restaurant}/orders/{order}` | â€” | Order snapshots/timeline; actor details Owner-only | `orders.view` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/orders/{order}/status` | Allowed next `status`, required `reason` for reject/cancel | Updated order and timeline | `orders.status.update`; reject/cancel additionally `orders.cancel` |

Business orders list and update records from the shared order tables; Customer checkout is not part of B5. Mock mode displays clearly labeled sample orders only. The order board polls every 12 seconds. Restaurant status changes follow the permitted workflow; the restaurant cannot advance Delivery beyond Ready, and only Pick-up orders can be marked Collected/Completed by the restaurant. Staff may progress orders but cannot reject or cancel. An unanswered Placed order is auto-cancelled after ten minutes with a system-authored status-history event. Discount redemption release depends on the later shared redemption/checkout implementation.

### Tables, reservations, discounts, reports, and calendar

| Method and URL | Request | Response | Required permission |
|---|---|---|---|
| `GET /api/v1/manage/restaurants/{restaurant}/tables` | Status/page filters | Table list | `tables.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/tables` | `table_number`, positive `capacity`, `area`, `status` | Table resource | `tables.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/tables/{table}` | Allowed table fields | Updated table and affected reservation warnings | `tables.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/tables/{table}` | Confirmation | Inactive table or 204 where safe | `tables.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/reservations` | Date/status/page filters | Paginated reservations | `reservations.view` |
| `GET /api/v1/manage/restaurants/{restaurant}/reservations/{reservation}` | â€” | Reservation detail | `reservations.view` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/reservations/{reservation}/status` | Confirm/decline/cancel/no-show and required reason | Updated reservation | `reservations.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/reservations/{reservation}/reschedule` | New start and duration | Updated reservation or free-slot validation errors | `reservations.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/reservation-settings` | â€” | Reservation settings | `reservations.view` |
| `PUT /api/v1/manage/restaurants/{restaurant}/business/reservation-settings` | Full validated settings | Updated settings | `reservations.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/discounts` | Date/active/page filters | Discounts with derived usage counts | `discounts.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/discounts` | Code/type/value/date/minimum/limits; funded by restaurant | Discount resource | `discounts.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/discounts/{discount}` | Allowed discount fields | Updated discount | `discounts.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/discounts/{discount}` | Confirmation | Deactivated discount | `discounts.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/reports/{report}` | `from`, `to`, filters | Report summary/series/table rows | Sales reports: `reports.sales_reservations.view`; reservation reports: `reports.reservations.view` |
| `GET /api/v1/manage/restaurants/{restaurant}/reports/{report}/export` | Same filters; CSV accept header | CSV download | Same permission as report |
| `GET /api/v1/manage/restaurants/{restaurant}/calendar` | `start`, `end`, event types | FullCalendar-compatible events | Matching reservations/hours permission; every included event policy-checked |
| `GET /api/v1/manage/restaurants/{restaurant}/business/dashboard` | Date range | Setup checklist or permitted daily summary | `restaurant.view` plus per-metric permission filtering |

## 6. Database proposal and sensitive edits

The proposed business schema and field-level constraints are in [DATABASE_DESIGN.md](./DATABASE_DESIGN.md). No migrations are included. Any schema change must be added to that document and approved before migration.

**Sensitive-field re-approval design:** reuse `RestaurantApplication` with `application_type` (`initial`, `sensitive_update`) and nullable `proposed_changes` JSON. A sensitive update is a new application record tied to the existing restaurant; it records submitter, reviewer, status, timestamps, and notes. Proposed values are not copied to the live `Restaurant` until an Admin approves. Permit files remain separate private `ApplicationDocument` rows. The user approved this approach and the initial-application lifecycle on 2026-10-30; this does not approve the full schema or authorize migrations.

## 7. Scheduled jobs

| Job | Schedule/trigger | Required behavior |
|---|---|---|
| Expire team invitations | Periodic | Mark unused invitations expired after 72 hours; token is single-use; resend/cancel are owner actions. |
| Expire pending restaurant application uploads | Retention policy | Delete rejected-application private documents after 30 days, subject to approved retention policy. |
| Reset daily menu quantities | At each restaurant's opening time, `Asia/Manila` | Restore configured daily quantities and availability rules idempotently. |
| Auto-cancel unanswered Placed orders | Every minute or equivalent | Cancel after 10 minutes with system reason; return stock and release discount atomically. |
| Expire pending reservation holds | Periodic | Expire after each restaurant's configured review window; release table availability. |
| Flag maintenance-affected reservations | On table status change | Notify/flag future reservations on a table moved to Maintenance. |
| Purge owner audit history | Daily | Remove records older than 90 days, according to approved retention requirements. |

Jobs must be retry-safe, observable, and implemented through services/actions, not inline scheduler queries. B0 defines requirements only; it creates no command or schedule.

## 8. Frontend page list

All pages must support `config.useMock`, use design tokens/shared components, show loading/empty/error/success states, use one primary orange action per view, and confirm destructive/status-changing actions. Data-heavy lists use server-side TanStack Table. Calendar pages use FullCalendar.

| Page / route | Main content | Access |
|---|---|---|
| Restaurant application wizard `/partner/apply` | Five steps, save/resume, OTP, documents/photos, review/submit, status and admin notes | Signed-in Customer mode |
| Business dashboard `/business` | Setup checklist or daily permitted overview | Any active restaurant member |
| Restaurant switcher (shell) | Restaurants accessible to user and active position | Any active member |
| Page editor `/business/profile` | Normal fields, preview, proposed sensitive edits | Owner/Manager; sensitive fields Owner |
| Photo manager `/business/photos` | Logo, cover, gallery upload/reorder/alt text | Owner/Manager |
| Hours and closures `/business/hours` | Weekly shifts, 24/7, closure calendar | Owner/Manager |
| Publish checklist `/business/publish` | Readiness items, publish/unpublish/close controls | Owner |
| Team `/business/team` | Hierarchy, permission preview, searchable/filterable membership and invitations | Read Owner/Manager; actions Owner |
| Audit history `/business/history` | Searchable before/after event list | Owner only |
| Menu `/business/menu` | Categories/items, lifecycle, price, tags, availability, quantities | Owner/Manager; Staff availability toggle only |
| Orders `/business/orders` | Polling board, filters, status actions and new-order notice | Owner/Manager/Staff |
| Order detail `/business/orders/:order` | Item snapshots, timeline, reasoned actions | Owner/Manager/Staff; actor names Owner only |
| Tables `/business/tables` | Table list/editor/status and affected booking warnings | Owner/Manager/Reservation Manager |
| Reservation settings `/business/reservations/settings` | Reservation policy and confirmation settings | Owner/Manager/Reservation Manager |
| Reservations `/business/reservations` | List, actions, availability checks | Owner/Manager/Reservation Manager |
| Calendar `/business/calendar` | Hours, closures, reservations, day/week/month | Permissions limited to included event types |
| Discounts `/business/discounts` | Restaurant-funded promotions and usage | Owner/Manager |
| Reports `/business/reports` | Role-filtered report selector/date range/CSV export | Owner/Manager; Reservation Manager reservation-only |

## 9. B0-B4 readiness and status

- [x] Inventory the foundation and record the Business API contract, page list, and scheduler requirements.
- [x] Implement the B0 identity, OTP, server-checked mode/membership, permissions, local storage, settings, and persistent application-queue foundations.
- [x] Implement the B1 application wizard, Admin review/approval flow, and Business workspace shell; owner confirms B1 was hand-tested.
- [x] Owner approved B0 and authorized B1.
- [x] Add B1 isolation tests: another user cannot read an application or its private documents, and duplicate approval cannot create a second restaurant. (Execution remains blocked by the local PHP version.)
- [ ] Run backend tests with a PHP runtime compatible with the installed Composer dependencies (>=8.4.1).
- [ ] Import and verify the official PSGC hierarchy; the import command exists but the source dataset is not checked in.
- [x] Implement B2 management routes, frontend surfaces, and migration for documented entities; do not run the migration until a compatible backend environment is available.
- [ ] Run backend feature tests and migration against the supported MySQL version, then complete B2 hand-testing.
- [x] Implement B3 team hierarchy, invitations, membership management, ownership transfer, and Owner audit history using the documented schema.
- [ ] Run B3 backend tests and migration using a supported PHP runtime; the invitations migration is written but has not been run.
- [ ] Complete B3 hand-testing of existing-account acceptance, new-account activation, membership changes, ownership transfer, and Owner-only audit history.
- [x] Implement B4 categories, items, dietary tags, photos, availability, bulk publish, audit writes, quantity-reset scheduling, and the published/orderable publish check.
- [ ] Run B4 backend tests and migration with a compatible PHP runtime and supported MySQL; do not run the migration before schema approval.
- [ ] Complete B4 hand-testing for Owner/Manager editing, Staff availability-only access, photo and private certificate uploads, price-change confirmation, and daily quantity reset.
- [ ] Integrate actual affected-cart detection when Customer cart records are implemented; B4 explicitly does not fabricate cart counts.
- [x] Implement B5 shared order tables proposal/migration, restaurant-scoped order API, status workflow, audit/history, auto-cancel scheduler, and Business order board. Do not start Customer checkout or B6-B7.
- [ ] Run B5 backend feature tests and shared-order migration with a compatible PHP runtime and supported MySQL; migration has not been run.
- [ ] Complete B5 hand-testing for Owner/Manager/Staff order actions, actor visibility, status filters/details, auto-cancel, and suspended read-only behavior.
- [ ] Extend cancellation to release discount redemptions when the shared discount/redemption records are implemented.

## 10. B8 QA acceptance checklist

Feature tests must verify:

- Restaurant A members cannot read or write restaurant B; every nested resource is checked against the route restaurant.
- One user may own multiple restaurants, and may also be Staff at a different restaurant.
- Managers cannot invite, change, or remove members; Staff cannot raise their own role; only Owner sees audit history.
- Removing or suspending a member blocks their next request. One user may own multiple restaurants and may also be Staff at another restaurant.
- Invitations expire at 72 hours, are single-use, and existing-account invites require acceptance. Last Owner cannot leave; ownership transfer requires current password.
- A suspended restaurant is read-only. Business mode cannot start customer checkout.
- Archived or sold-out items are not orderable; status transitions require valid permissions and required reasons.
- Business orders are scoped by the route restaurant; only valid status transitions succeed; reject/cancel requires a reason; Staff cannot reject/cancel; only Owner sees status actors; unanswered Placed orders auto-cancel after 10 minutes.
- Staff can toggle only item availability; price changes require explicit confirmation; Halal-certified tags are blocked without a valid certificate.
- Two simultaneous reservations for a table yield exactly one winner; hold expiry and order auto-cancel scheduler jobs run and are retry-safe.
- Upload checks reject unsupported formats, oversized files, and fake MIME types. Unauthorized users cannot access private documents.
- A restaurant cannot publish before every checklist requirement is satisfied.

Then test every page at 375, 768, 1280, and 1920 px and with keyboard-only navigation. The final QA deliverable is a Double-Check Report mapping every route and permission, each business rule to its service and test, scheduler jobs, and assumptions.
