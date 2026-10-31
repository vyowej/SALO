# SALO Business Side

**Status:** B0 documentation and B1 onboarding are complete; B1 was hand-tested by the owner. B2-B7 implementation code is present, but backend tests and migration execution await a compatible PHP runtime; the work also awaits hand-testing. [DATABASE_SCHEMA_V3.sql](./DATABASE_SCHEMA_V3.sql) is the authoritative physical schema and overrides this document, [SALO_PLAN_v2.md](./SALO_PLAN_v2.md), and unapplied migrations/models. No database exists and no migration has been applied. Do not execute v3: it begins with DROP/CREATE DATABASE statements. The owner will edit v3; this document records the agreed multi-owner product rule but marks the incompatible schema/code path [VERIFY].

This documentation-only update does not remove legacy ownership-transfer routes or behavior from the code. They may still be present; they are not approved for use and must not be treated as the agreed workflow.

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
| Database design and migrations | v3 is authoritative; Laravel migrations are unrun legacy proposals | The checked-in migration/model code does not match v3 in multiple fields and keys. No migration was executed and no table is assumed to exist. Do not migrate until the owner has updated the schema and separately approved implementation. |
| Business backend and UI | B1 hand-tested; B2-B7 code present, runtime verification pending | The existing team implementation assumes one Owner and supports legacy ownership transfer. It does not implement several Owners or add-owner invitations; disable/use neither transfer nor manager-request flows pending v3 update. |

### Remaining verification

The B0 foundation and B1 application workflow are implemented. Added B1 application/document isolation and idempotent-approval tests remain unexecuted because the available PHP CLI is 8.0.30, while installed Composer dependencies require PHP >=8.4.1. The official PSGC hierarchy still needs import/verification. B2-B7 tests and migration execution also await a compatible PHP runtime. The current v3 restaurant row and staff roles cannot represent several Owners; multi-owner behavior and adding an Owner remain blocked until the owner updates v3.

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

The keys below are the stable identifiers for the single `PermissionMap`. The implementation must not reproduce grants in controllers or client-side role-name checks. Every Owner has the same permission set. The current schema/code can expose only one Owner; multi-owner authorization is [VERIFY] until v3 is updated and approved for implementation.

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

Managers may see the team list, but only an Owner receives management actions or reads audit history. Owner audit history is not inherited by managers. A suspended restaurant is read-only for all memberships. Restaurant membership never grants platform capability. An Owner may add another Owner but cannot transfer ownership; Manager ownership-change requests are removed. [VERIFY] `team.manage` currently covers only v3-supported staff roles; adding Owner invitations requires the owner to update the schema first.

The legacy Owner membership shown by `/auth/me` and Team is synthesized from `restaurants.owner_user_id`; v3 has no representation for additional Owners. Do not treat that legacy synthesis as the final multi-owner design. The Owner reads their restaurant history through the Business audit route. Admin reads through the Admin namespace in Phase 1; no duplicate Admin route is added to the Business namespace.

## 4. Business workflows

### B1 â€” Restaurant application and workspace shell

1. A signed-in Customer starts or resumes one restaurant application from Customer mode. A Business-mode user is directed to Customer mode before starting.
2. The five-step wizard saves a Draft between steps: About; Location and hours; Documents; Photos; Review and submit. Business email verification is a distinct OTP purpose.
3. Location uses PSGC hierarchy/search and a pin; hours are weekly shifts or Open 24/7. Enforce at least four open hours per day and five days per week unless 24/7.
4. Validate three required document types (business/mayor's permit, DTI/SEC registration, owner's valid ID), photo/PDF, at most 2 MB, using actual file type. Store only paths in the database on the private disk.
5. Submit changes the application to Submitted. Admin moves it to Under Review and may approve, reject, or request revision with notes. Applicant can fix and resubmit.
6. On approval, create the restaurant from the validated application and assign the applicant as the initial Owner represented by v3's `owner_user_id`. A user may own multiple restaurants. Additional Owners are an agreed product behavior but require the owner to update v3 before implementation. Approval does not publish the restaurant. The initial Owner sees the Business mode and restaurant switcher. A setup checklist links to required page, hours, menu, tables, and publish actions.
7. Dashboard shows today's permitted operations. The development-only simulated-order control is unavailable outside a local environment.

### B2 â€” Page editor, photos, and hours

- Owner and Manager edit normal page fields, cuisine/category associations, contact, photos, hours, and closures. Only Owner edits legal name, address, and permit details; these edits become a proposed sensitive update and do not replace the live values until admin approval.
- Restaurant application/location and sensitive-address forms use the shared order Country, Province, City or Municipality, Barangay, Street, House number. Country is shown as Philippines, locked for now, and stored as `country_code="PH"`. PSGC fields are type-ahead with parent validation; persist one barangay leaf code and derive ancestors locally. NCR displays `Metro Manila (NCR)` in the skipped province position, while independent cities such as Zamboanga City display `None (independent city)`. Street is free text with optional suggestions from a Philippines-limited provider called through the backend; house number is optional free text. The owner confirmed requiredness and intended columns; v3 still needs the owner's edit before implementation. Show and persist the one-line formatted address; current v3 restaurant fields do not represent every component.
- Photos are browser-compressed, server-validated JPG/PNG/WebP with EXIF removed and generated names; store on the public disk. Generate thumbnail/medium variants, track upload progress, and remove replaced files safely. Gallery limit is ten; support alt text, ordering, and primary selection.
- Weekly hours support one or more shifts and overnight flags. `is_open_now` is derived using `Asia/Manila`. Open 24/7 bypasses ordinary-hours checks.
- Publish, unpublish, or close is Owner-only and confirmed. Publishing requires Approved status, pinned address, hours or 24/7, a category, and at least one published/orderable item. Halal badge requires a certificate.

### B3 â€” Team and hierarchy

- Team page displays Owner(s) > Manager > Reservation Manager and Staff, current members, position descriptions, current holders, and a permission preview. Staff invitations and appointment are accessed in Settings → Staff & Permissions; only an Owner can perform them.
- Owner(s) and Manager can read members; Managers see masked emails and no staff-management actions. Only an Owner invites, changes position, suspends/reactivates, and removes staff.
- Owner enters an exact email only. Existing account lookup returns only the minimal confirmation identity and requires the invitee's acceptance. A new email creates an Invited account. At invitation time, create the `restaurant_staff` row with status Invited; the `invitations` row owns the token hash, expiry, and invitation status. Never accept a password from the Owner.
- Existing invitees accept through an authenticated, email-matched endpoint. New invitees use the unauthenticated, token-gated activation endpoint to set their own password; it is rate-limited and single-use. Acceptance/activation changes the invitation to Accepted, the Invited account to Active when applicable, and the staff row to Active atomically. Expiry or cancellation changes the invitation to Expired/Cancelled and the staff row to Removed. Resending a pending invitation updates its expiry and token.
- Invitation links expire after 72 hours; resend and cancel are available. Rate-limit lookup at 10/minute/owner and audit checks/invitations. This exact-email feature intentionally reveals limited account existence to a restaurant Owner; do not expose a directory or broader search.
- One `restaurant_staff` row per user per restaurant, including Removed rows, which are reactivated rather than duplicated on re-invitation. Role changes/removal affect the next API request. Staff cannot self-escalate; no staff member can edit an Owner. An Owner may add another Owner but cannot transfer ownership. Manager ownership-change requests and transfer endpoints are removed. **[VERIFY]** V3 `restaurant_staff.staff_role` excludes Owner and `invitations` targets staff rows; the add-owner invitation flow cannot be implemented until the owner updates v3. Do not use the legacy direct-transfer behavior in the meantime. Admin ownership reassignment is not specified by the current rule and remains [VERIFY].
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
- The Reservations page supports list/calendar views (day/week/month), confirm, decline, reschedule after availability checks, cancel with a reason, and No Show after the grace period. V3 has no dedicated response-reason or late-cancel column; record relevant decline/cancel reasons in `audit_logs` and do not invent reservation fields. Pending holds expire after the configured review window; the expiry command runs every minute.

### B7 â€” Discounts, reports, and calendar

- Restaurant discounts are restaurant-funded. V3 `discounts.type` carries percentage, fixed, free delivery, and first-order eligibility; do not use the legacy `first_order_only` flag representation. The current B7 code still uses that legacy flag and has not been changed or verified against v3. A null `per_customer_limit` means no per-customer cap. The exact first-order qualifying-order rule is [VERIFY] against v3's intended semantics. Admin CRUD and a standalone server-side validation/quote function are in B7; checkout wiring and redemption recording are not.
- The quote function checks scope, active dates, minimum order, total/per-customer limits, first-order eligibility, and calculates percentage (with optional cap), fixed (capped by eligible subtotal), and delivery discounts. It returns the plan's validation messages and a server-calculated total; checkout must revalidate inside its transaction.
- Reports support date range and CSV: sales summary, orders by status, popular items, discount use, reservations, and no-show rate. Reservation Manager receives reservation-only reports. Owner and Manager receive sales and reservation reports.
- Combined calendar displays operating hours, closure dates, and reservations. FullCalendar is the UI calendar component.
- Report definitions: sales is completed-order `total_amount` after discounts, including fees. No-show rate is `no_show / (completed + no_show)`; other reservation states are excluded from its denominator.
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
| `GET /api/v1/manage/restaurants/{restaurant}/business` | â€” | Restaurant profile, membership role, `permissions[]`, suspended/inactive read-only flag | `restaurant.view` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/business/profile` | Editable normal page fields | Updated profile | `restaurant.page.edit` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/business/sensitive-profile` | Legal name/address/permit proposal | Pending change request; live values unchanged | `restaurant.sensitive.edit` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/preview` | â€” | Customer-visible restaurant resource | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/publish` | â€” | Updated publish state/checklist errors | `restaurant.publish` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/publish-checklist` | â€” | Current publish checks, including the orderable-item check | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/unpublish` | Confirmation | Updated publish state | `restaurant.publish` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/close` | `closed`, optional reason | Updated operational state | `restaurant.publish` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/deactivate` | Confirmation | Sets status to `inactive`, unpublishes, and records before/after audit; Owner retains read-only access and other staff are denied | Owner-only `restaurant.publish` |
| `POST /api/v1/manage/restaurants/{restaurant}/business/reactivate` | Confirmation | Owner-only reactivation from `inactive` to `approved`; remains unpublished; before/after audit | Owner-only `restaurant.publish`; Admin-suspended restaurants cannot use this endpoint |
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
| `GET /api/v1/manage/restaurants/{restaurant}/audit` | Search/action/date/page filters | Paginated before/after audit records | `audit.view` (Owner only) |

The Team response includes `positions` with permission previews and an `assignable` flag, `position_holders`, paginated `members` with a server-computed `can_manage_member` flag, pending `invitations`, and `can_manage`. Member filters are `search`, `position`, `status`, `page`, and `per_page`; Managers' search matches names only so masked emails cannot be inferred. Staff email-check and invitation audit entries store a one-way email hash rather than the searched address. A new account is created in `invited` state with temporary placeholder name values because the user schema requires names; the invitee replaces them with their own first and last names during activation. An Owner never sets or receives a password. Activation is not available to authenticated sessions; an already-active account must authenticate and use the acceptance endpoint. Adding another Owner will use exact-email lookup and explicit invitation acceptance/activation, but its route, membership persistence, and invitation role are **[VERIFY]** until the owner updates v3. No ownership-transfer or Manager ownership-change request route is part of the contract.

The existing Admin ownership-reassignment behavior is not covered by the agreed ownership rule and is **[VERIFY]**; do not treat it as an approved transfer path.

### Menu and order endpoints

| Method and URL | Request | Response | Required permission |
|---|---|---|---|
| `GET /api/v1/manage/restaurants/{restaurant}/menu` | Category/search/status filters | Categories and items | `restaurant.view` |
| `POST /api/v1/manage/restaurants/{restaurant}/menu/categories` | `name`, optional `sort_order` | Category resource | `restaurant.menu.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/menu/categories/{category}` | `name`, `sort_order`, `status` (`active`, `archived`) | Updated category | `restaurant.menu.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/menu/categories/{category}` | Confirmation | Archived category | `restaurant.menu.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/menu/items` | Multipart: required JPG/PNG/WebP `file` plus category, name, description, positive price, lifecycle, tags, quantity | Item resource with image path stored atomically with creation | `restaurant.menu.manage` |
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
| `PATCH /api/v1/manage/restaurants/{restaurant}/tables/{table}` | Allowed table fields | Updated table and count of affected future reservations | `tables.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/tables/{table}` | Confirmation | 204 when no reservation history; otherwise validation error instructing the user to set the table Inactive | `tables.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/reservations` | Date/status/page filters | Paginated reservations | `reservations.view` |
| `GET /api/v1/manage/restaurants/{restaurant}/reservations/{reservation}` | â€” | Reservation detail | `reservations.view` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/reservations/{reservation}/status` | `status` (`confirmed`, `declined`, `cancelled`, `completed`, `no_show`); `reason` required for decline/cancel | Updated reservation; No Show is blocked until the configured grace period elapses | `reservations.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/reservations/{reservation}/reschedule` | `start_at`; optional `duration_minutes`, `table_id` | Updated reservation or availability validation errors | `reservations.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/reservation-settings` | â€” | Reservation settings | `reservations.view` |
| `PUT /api/v1/manage/restaurants/{restaurant}/business/reservation-settings` | Full validated settings | Updated settings | `reservations.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/discounts` | Date/active/page filters | Discounts with derived usage counts | `discounts.manage` |
| `POST /api/v1/manage/restaurants/{restaurant}/discounts` | Code/type/value/date/minimum/limits; v3 type includes `first_order`; funded by restaurant | Discount resource | `discounts.manage` |
| `PATCH /api/v1/manage/restaurants/{restaurant}/discounts/{discount}` | Allowed v3 discount fields, including `type` | Updated discount | `discounts.manage` |
| `DELETE /api/v1/manage/restaurants/{restaurant}/discounts/{discount}` | Confirmation | Deactivated discount | `discounts.manage` |
| `GET /api/v1/manage/restaurants/{restaurant}/reports/{report}` | `from`, `to`, filters | Report summary/series/table rows | Sales reports: `reports.sales_reservations.view`; reservation reports: `reports.reservations.view` |
| `GET /api/v1/manage/restaurants/{restaurant}/reports/{report}/export` | Same filters; CSV accept header | CSV download | Same permission as report |
| `GET /api/v1/manage/restaurants/{restaurant}/calendar` | `start`, `end` | FullCalendar-compatible hours, closure, and permitted reservation events | `restaurant.view` or `reservations.view`; reservation events are omitted without `reservations.view` |
| `GET /api/v1/manage/restaurants/{restaurant}/business/dashboard` | Date range | Setup checklist or permitted daily summary | `restaurant.view` plus per-metric permission filtering |

## 6. Schema authority and sensitive edits

[DATABASE_SCHEMA_V3.sql](./DATABASE_SCHEMA_V3.sql) is the authoritative physical schema; it overrides older schema proposals and code. Its 49 application tables and constraints are intended design only: no database exists and no migration has been applied. The owner will edit v3 for any required table or column changes. This document and [SCHEMA_GAP_REPORT.md](./SCHEMA_GAP_REPORT.md) identify mismatches; no migration, code alignment, or database operation is authorized by this documentation update. Do not execute v3 because it begins with DROP/CREATE DATABASE statements.

The current v3 schema cannot represent several Owners: `restaurants.owner_user_id` is a single required FK, `restaurant_staff.staff_role` excludes Owner, and `invitations` targets a staff row. **[VERIFY]** The owner must update v3 before the add-Owner API/UI is implemented. Do not represent an Owner as a Manager or as ordinary staff.

**Sensitive-field re-approval design:** reuse `RestaurantApplication` with `application_type` (`initial`, `sensitive_update`) and nullable `proposed_changes` JSON. A sensitive update is a new application record tied to the existing restaurant; it records submitter, reviewer, status, timestamps, and notes. Proposed values are not copied to the live `Restaurant` until an Admin approves. Permit files remain separate private `ApplicationDocument` rows. The user approved this approach and the initial-application lifecycle on 2026-10-30; this does not approve the full schema or authorize migrations.

## 7. Scheduled jobs

| Job | Schedule/trigger | Required behavior |
|---|---|---|
| Expire team invitations | Periodic | Mark unused invitations expired after 72 hours; token is single-use; resend/cancel are owner actions. |
| Expire pending restaurant application uploads | Retention policy | Delete rejected-application private documents after 30 days, subject to approved retention policy. |
| Reset daily menu quantities | At each restaurant's opening time, `Asia/Manila` | Restore configured daily quantities and availability rules idempotently. |
| Auto-cancel unanswered Placed orders | Every minute or equivalent | Cancel after 10 minutes with system reason; return stock and release discount atomically. |
| Expire pending reservation holds | Every minute | Mark holds Expired when their configured review-window expiry is due; release table availability. |
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
| Team `/business/team` | Appointed members, hierarchy, permission preview, searchable/filterable membership | Read Owner/Manager; member actions Owner |
| Business Settings `/settings` in Business mode | Staff & Permissions, Owner-only add-Owner entry once supported, business deactivation danger zone | Staff actions Owner-only; add-Owner entry blocked pending v3 update |
| Audit history `/business/history` | Searchable before/after event list | Owner only |
| Menu `/business/menu` | Categories/items, lifecycle, price, tags, availability, quantities | Owner/Manager; Staff availability toggle only |
| Orders `/business/orders` | Polling board, filters, status actions and new-order notice | Owner/Manager/Staff |
| Order detail `/business/orders/:order` | Item snapshots, timeline, reasoned actions | Owner/Manager/Staff; actor names Owner only |
| Tables (Reservations page tab; `/business/tables` alias) | Table list/editor/status and affected reservation counts | Owner/Manager/Reservation Manager |
| Reservation settings (Reservations page tab) | Reservation policy and confirmation settings | Owner/Manager/Reservation Manager |
| Reservations `/business/reservations` | Calendar/list, actions, availability checks | Owner/Manager/Reservation Manager |
| Discounts `/business/discounts` | Restaurant-funded promotions and usage | Owner/Manager |
| Reports `/business/reports` | Role-filtered report selector/date range/CSV export | Owner/Manager; Reservation Manager reservation-only |
| Calendar `/business/calendar` | Combined operating hours, closures, and permitted reservations | Restaurant members; reservation events require `reservations.view` |

### B6 reservation and table behavior

- Reservation states follow the approved plan: `pending`, `confirmed`, `declined`, `expired`, `cancelled`, `completed`, and `no_show`. Older documents and mock fixtures that use `rejected` or `seated` are not authoritative.
- Pending holds expire after the configured review window via the every-minute expiry command. Availability checks consider only unexpired Pending holds and Confirmed reservations, require an Active table with sufficient capacity, and check restaurant hours, 24/7 status, and closure dates.
- Rescheduling is available only for Pending or Confirmed reservations and must reserve a free table/slot transactionally. Table Maintenance does not delete reservations; it creates an Owner notification and future active reservations on any non-Active table are derived as needing attention.
- Business management provides table/settings/reservation APIs and a reservation-only FullCalendar view. Customer booking endpoints remain outside this Business phase; the shared availability service is ready for that later integration.
- Reservation cancellation-cutoff bounds are not defined by the plan's V9. The current settings validation accepts a non-negative integer and needs an Admin-configured range before the public booking flow is enabled. [VERIFY]

## 9. B0-B7 readiness and status

- [x] Inventory the foundation and record the Business API contract, page list, and scheduler requirements.
- [x] Implement the B0 identity, OTP, server-checked mode/membership, permissions, local storage, settings, and persistent application-queue foundations.
- [x] Implement the B1 application wizard, Admin review/approval flow, and Business workspace shell; owner confirms B1 was hand-tested.
- [x] Owner approved B0 and authorized B1.
- [x] Add B1 isolation tests: another user cannot read an application or its private documents, and duplicate approval cannot create a second restaurant. (Execution remains blocked by the local PHP version.)
- [ ] Run backend tests with a PHP runtime compatible with the installed Composer dependencies (>=8.4.1).
- [ ] Import and verify the official PSGC hierarchy; the import command exists but the source dataset is not checked in.
- [x] Implement B2 management routes, frontend surfaces, and migration for documented entities; do not run the migration until a compatible backend environment is available.
- [ ] Run backend feature tests and migration against the supported MySQL version, then complete B2 hand-testing.
- [x] Implement the legacy B3 team hierarchy, invitations, membership management, and Owner audit history. The implementation assumes one Owner and includes ownership-transfer behavior that is not part of the agreed rule.
- [ ] After the owner updates v3, redesign B3 for multiple Owners and Owner-only add-Owner invitation/acceptance. Remove/disable legacy transfer behavior; no Manager ownership-change request feature.
- [ ] Run B3 backend tests and migration using a supported PHP runtime; the invitations migration is written but has not been run.
- [ ] Complete B3 hand-testing of existing-account acceptance, new-account activation, membership changes, multiple-owner/add-owner behavior after schema approval, and Owner-only audit history. Do not test or rely on ownership transfer.
- [x] Implement B4 categories, items, dietary tags, photos, availability, bulk publish, audit writes, quantity-reset scheduling, and the published/orderable publish check.
- [ ] Run B4 backend tests and migration with a compatible PHP runtime and supported MySQL; do not run the migration before schema approval.
- [ ] Complete B4 hand-testing for Owner/Manager editing, Staff availability-only access, photo and private certificate uploads, price-change confirmation, and daily quantity reset.
- [ ] Integrate actual affected-cart detection when Customer cart records are implemented; B4 explicitly does not fabricate cart counts.
- [x] Implement B5 shared order tables proposal/migration, restaurant-scoped order API, status workflow, audit/history, auto-cancel scheduler, and Business order board. Do not start Customer checkout or B6-B7.
- [ ] Run B5 backend feature tests and shared-order migration with a compatible PHP runtime and supported MySQL; migration has not been run.
- [ ] Complete B5 hand-testing for Owner/Manager/Staff order actions, actor visibility, status filters/details, auto-cancel, and suspended read-only behavior.
- [ ] Extend cancellation to release discount redemptions when the shared discount/redemption records are implemented.
- [x] Implement B6 tables, reservation settings, scoped reservation management, availability/rescheduling logic, reservation expiry, maintenance notifications, and reservation calendar. Customer booking remains out of scope.
- [ ] Run B6 backend feature tests and migration with a compatible PHP runtime and supported MySQL; do not run the migration before schema approval.
- [ ] Complete B6 hand-testing for table statuses, settings, reservation decisions/rescheduling, availability conflicts, closure/hour checks, hold expiry, and maintenance attention notifications.
- [x] Implement B7 restaurant discount CRUD, documented discount schema/migration proposal, standalone discount validation/quote logic, date-range reports/CSV, and combined business calendar. Customer checkout/redemption recording remains out of scope.
- [ ] Run B7 backend feature/unit tests and discount migration with a compatible PHP runtime and supported MySQL; do not run the migration before approval.
- [ ] Complete B7 hand-testing for discount eligibility/pricing, report permissions and CSV export, calendar event composition, and suspended read-only behavior.

## 10. B8 QA acceptance checklist

Feature tests must verify:

- Restaurant A members cannot read or write restaurant B; every nested resource is checked against the route restaurant.
- One user may own multiple restaurants and may also be Staff at a different restaurant. Several Owners per restaurant is a product rule but cannot be tested until v3 is updated.
- Managers cannot invite, change, or remove members; Staff cannot raise their own role; only Owners see audit history.
- Removing or suspending a member blocks their next request. One user may own multiple restaurants and may also be Staff at another restaurant.
- Staff invitations expire at 72 hours, are single-use, and existing-account invites require acceptance. An Owner cannot transfer ownership and may add another Owner only through an approved schema-backed flow. Do not rely on the legacy transfer implementation.
- A suspended restaurant is read-only. Business mode cannot start customer checkout.
- Archived or sold-out items are not orderable; status transitions require valid permissions and required reasons.
- Business orders are scoped by the route restaurant; only valid status transitions succeed; reject/cancel requires a reason; Staff cannot reject/cancel; only Owner sees status actors; unanswered Placed orders auto-cancel after 10 minutes.
- Reservation state transitions match the plan; pending holds expire; overlapping bookings cannot claim one table; rescheduling checks current table availability; Maintenance notifications and attention reservations are scoped to the restaurant.
- Staff can toggle only item availability; price changes require explicit confirmation; Halal-certified tags are blocked without a valid certificate.
- Two simultaneous reservations for a table yield exactly one winner; hold expiry and order auto-cancel scheduler jobs run and are retry-safe.
- Upload checks reject unsupported formats, oversized files, and fake MIME types. Unauthorized users cannot access private documents.
- A restaurant cannot publish before every checklist requirement is satisfied.

Then test every page at 375, 768, 1280, and 1920 px and with keyboard-only navigation. The final QA deliverable is a Double-Check Report mapping every route and permission, each business rule to its service and test, scheduler jobs, and assumptions.

## 11. B8 execution status

- [x] Add focused feature-test assertions for team/ownership and upload validation.
- [x] Render the Business route/tab matrix at 375, 768, 1280, and 1920 px; resolve the Reservations/Tables mobile overflow.
- [x] Run frontend lint and production build; complete a keyboard-navigation smoke check.
- [x] Write the route/permission, service/test, scheduler, and assumptions report in `docs/BUSINESS_DOUBLE_CHECK_REPORT.md`.
- [ ] Run backend feature/unit tests and supported-MySQL migrations; blocked because the available PHP runtime is 8.0.30 and Composer requires PHP >= 8.4.1. No migration was run.
- [ ] Resolve the implemented `/api/v1/manage/restaurants/{restaurant}/...` versus approved `/api/v1/restaurants/{restaurant}/...` API base-path mismatch.
- [ ] Add and run explicit concurrency coverage proving exactly one overlapping reservation wins; complete the remaining live-backend and exhaustive keyboard/manual checks.

B8 remains partly complete until the blocked backend verification and listed acceptance gaps are resolved.
