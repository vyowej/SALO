# SALO Driver (Rider) Side

**Status:** D0 audit and design only. No rider implementation was changed, no
test or migration was run, and no database was queried. The owner states that
the live MariaDB 10.11 database `salo` is connected and was imported from the
root schema. This document treats that as an operating constraint, not as a
claim that D0 independently verified the connection.

## 1. Authority, scope, and safety

Read together for this audit:

- [Driver-side implementation prompt](./driver-side-v2.md)
- The owner-supplied rider addendum (the separate `docs/prompts/driver-side-addendum.md`
  path was not present in this checkout; its full text was supplied in the
  conversation and is applied here as controlling where it differs)
- [SALO Plan v2](./SALO_PLAN_v2.md)
- [Authoritative root SQL](../database/salo_db.sql)
- [Customer-side documentation](./CUSTOMER_SIDE.md)
- [Business-side documentation](./BUSINESS_SIDE.md)
- [Schema gap report](./SCHEMA_GAP_REPORT.md)

The root `database/salo_db.sql` is the physical-schema authority. Do not edit
or execute it: its preamble drops and recreates `salo`. The older plan and
other documentation contain schema descriptions that do not all match the
current root SQL. In particular, the SQL text now includes an `owner` staff
role, owner invitations, and `co_owner_requests`; follow the SQL rather than
older statements that these structures are absent. This rider audit proposes
no owner-related changes.

These database rules apply to every rider phase:

- Rider reads and writes use Eloquent-backed repositories and the existing
  MariaDB tables. `config.useMock` remains off for rider features. Only the
  local dev panel and demo mode may use mock behavior.
- Never run `php artisan migrate`, any other migration command, DDL, `TRUNCATE`,
  or destructive SQL against `salo`. Do not edit `database/salo_db.sql`.
- Any schema change is a numbered SQL proposal in this document and is for the
  owner to apply. No proposal is applied by the application.
- Tests use only the separately guarded `salo_test` database and a fake file
  disk. Before any test touches a database, both the configured database name
  and `SELECT DATABASE()` must end in `_test`; a mismatch must fail closed.
- Files uploaded by riders are private local-disk files. Do not put an image,
  file data URL, or image blob in browser `localStorage`.
- D0 is audit and documentation only. Stop for review after this phase.

## 2. D0 prerequisite audit

This is a repository/source audit. No live database, mail server, browser
device mode, or phone was used during D0.

| Prerequisite | What exists in source | D0 finding |
|---|---|---|
| Auth, OTP, and current account | Database-backed auth/token services, login/registration, OTP verification, `/api/v1/auth/me`, and session-backed mode switching exist. `AuthTokenService` recognizes the `rider_activation` OTP purpose and shared OTP settings. | Useful foundation exists, but no rider activation controller/route sends or verifies the rider-activation OTP or changes the rider to active after verification. Delivery of email was not tested. |
| Driver capability and mode | The frontend has a Rider capability/mode mapping and `/rider` route guard. The backend has platform-capability middleware and derives account capabilities in `/auth/me`. | Rider mode is not a substitute for backend authorization. No database-backed rider capability lifecycle is wired to approval, OTP activation, or resignation. |
| `PermissionMap` | `PermissionMap` exists for restaurant staff permissions. | It does not define rider action permissions. Rider APIs need policies that check the authenticated user's own `RiderProfile`, active rider state, current assignment, order participation, and Admin capability. |
| Rider application | `/rider/apply`, `RiderApplyPage`, and rider application fixtures exist. | The current page is a client-only single-page form and preview; it does not create/save a draft, upload documents, submit an application, or call a rider endpoint. There is no rider application controller, service, or database repository. |
| Rider persistence model | `RiderProfile` Eloquent model exists and maps the root profile fields. | No rider document, zone, shift, assignment, delivery, offer, or rider-review Eloquent models/repositories/services were found. Existing rider data is not persisted through rider repositories. |
| Admin application queue | Admin application list/detail/review routes exist, including approve, reject, request-revision, and start-review. Existing Admin application document routes support private application files. | The generic Admin routes do not provide a complete database-backed rider review flow. The configured `AdminRepository` is `InMemoryAdminRepository`; it serves fabricated riders, schedules, proofs, and related records. The database application repository is for restaurant applications, not a rider application workflow. A rider review screen and private rider-document access remain to be implemented. |
| Zones, shifts, and capacity | The Admin API exposes legacy `/admin/service-areas`, `/admin/schedules`, and schedule generation; `ScheduleGenerator` exists. | These are wired to the in-memory Admin repository and legacy service-area/date fixtures. They are not database-backed operations on `zones`, `shifts`, `zone_shift_capacities`, or `rider_shift_assignments`; no automatic nearest-zone capacity assignment or persistent waitlist is wired. |
| Orders, dispatch, and delivery | Business order management and customer order/tracking routes exist. Root SQL has delivery and offer tables. | No dispatch service, rider offer endpoints, rider delivery endpoints, database delivery repository, or rider-to-order state transitions exist. The customer tracking route is not yet a cache-backed live-rider tracking API. |
| Notifications | Database-backed notification infrastructure exists for current platform/customer/business surfaces. | Rider offer, assignment, timeout, delivery, and email notifications are not wired. No rider-specific delivery/email test was run. |
| Local files | Explicit `private` and `public` local disks exist. `FILESYSTEM_DISK=local` resolves to the configured private root; the public disk maps to `storage/app/public`. `backend/storage/app/private/.gitignore` ignores files in that private directory. | Existing storage primitives can be reused, but rider photo/document/proof validation, replacement cleanup, signed delivery-proof access, retention, and orphan cleanup are missing. |
| Email | The backend has Laravel notification/mail support and a configured mail transport in local environment configuration. | Configuration presence is not proof of delivery. No rider activation email is implemented or sent, and no SMTP credentials are included in this report. |
| Test database guard | `backend/.env.testing` names `salo_test`, but `backend/phpunit.xml` force-overrides the connection and database to SQLite `:memory:`. `Tests\TestCase` uses `RefreshDatabase`. | The current harness is not the required guarded `salo_test` harness. It does not check `SELECT DATABASE()`; running the current suite would not verify the rider feature against the required test schema. No tests were run. Establish and verify the guard before rider tests; never point tests at `salo`. |
| Existing rider UI and API adapter | `/rider` and `/rider/apply` are registered. `riderService` reads and mutates dashboard fixtures. | The current Rider dashboard is mock-backed regardless of the rider API and includes an unwired proof input. Existing layouts/styles do not meet the new rider acceptance criteria. These are starting points only, not completed rider features. |

### D0 readiness conclusion

The auth/session, shared OTP/token, local disk, platform settings, notification,
Eloquent, and shared order foundations can be reused. Rider application,
review, zone/shift persistence, dispatch, rider APIs, live location, delivery
proof handling, earnings, and resign are not complete. Admin rider/scheduling
routes and the current Rider UI are fixture-backed and must not be presented
as live rider functionality. Do not start D1 until the owner reviews this
audit and the test harness is made safe for `salo_test`.

## 3. Root-schema comparison and proposals

The following is based on the root SQL text, not a connection to `salo`.
Existing schema names and nullability must be matched exactly by models and
repositories.

| Root SQL table/field | Rider requirement and fit |
|---|---|
| `rider_profiles` | Has one profile per user; draft/submitted/review/approved/rejected application lifecycle; `status` values for pending activation, active, suspended, and resigned; online/offline/busy availability; vehicle, plate, PH home address/pin, payout account name, clearance/TIN declaration, reviewer, notes, and timestamps. Its check requires home address fields once the application leaves draft. The service must still validate the complete address and 18+ age rule. |
| `rider_documents` | Private `private_path`, `verified`, and unique `(rider_id, doc_type)`. The four document types are `profile_photo`, `id_photo`, `drivers_license`, and `or_cr`, sufficient for the rider wizard. All four files, including profile photos, are private under the addendum. Replace an existing document record/file rather than creating duplicate document types. |
| `rider_preferred_shifts` | Supports rider-selected shifts. |
| `zones`, `shifts`, `zone_shift_capacities` | Store active zones, shift time windows, and one capacity per zone/shift. |
| `rider_shift_assignments` | Stores one assignment/waitlist per rider/shift, assigned zone or `NULL` while waitlisted, assignment source, actor, and reason. Lock the corresponding zone/shift capacity row and count assigned riders in the same transaction. This is a standing shift assignment; it has no date field. |
| `deliveries` | One delivery per order; stores rider, delivery state, timestamps, proof path and coordinates, distance, earning, COD cash, and remittance flag. Proof fields are nullable in SQL, so the completion service must require a valid proof. |
| `delivery_offers` | Stores each offer attempt, response (`accepted`, `declined`, `timeout`), and times. Use it for retry history; do not invent a job board. |
| `orders`, `order_status_histories`, `payments` | Orders and status history support rider delivery transitions. Delivery orders move to `out_for_delivery` when picked up and `delivered` after proof is saved; customer receipt confirmation remains the existing Customer flow. COD total comes from the order/payment records, not client input. |
| `auth_tokens`, `platform_settings` | `rider_activation` is an allowed token purpose. Starter settings include `rider_ack_seconds=60`, `rider_share_percent=80`, `delivery_proof_retention_days=30`, and `max_zone_distance_km=10`. OTP validity, attempts, and resend settings are also present. Service code must read settings and validate their ranges. |
| `notifications`, `audit_logs` | Support rider/account notifications and auditable Admin reviews, overrides, suspension, remittance, and other sensitive actions. |

### Decisions and schema gaps

1. **Delivery status steps:** `deliveries.status` allows `offered`, `accepted`,
   `picked_up`, `delivered`, `failed`, and `cancelled`; it does not allow
   `at_restaurant` or `arrived`. The D1-D6 implementation will use only
   existing values. Reaching the restaurant is a UI/map milestone, not a
   persisted status. No enum proposal is needed.
2. **Documents and private photos:** the existing rider document enum is
   sufficient for the wizard, and the proof path/coordinate fields are
   sufficient for delivery proof. No table or column proposal is needed for
   the currently defined flow. Profile photos remain private; do not add a
   public avatar.
3. **Settings:** `rider_ack_seconds`, `rider_share_percent`,
   `delivery_proof_retention_days`, and `max_zone_distance_km` are present in
   root SQL starter settings. No settings/schema proposal is needed.
4. **Date-specific shifts [VERIFY]:** current tables represent recurring
   rider-to-zone/shift assignment, not a date-specific roster. The rider
   prompt does not require one-off dates or days off, so this audit does not
   treat that as a required schema change. If the owner expects a calendar of
   dated shifts, approve this separate proposal before implementing that
   behavior:

   **Proposal 1 (conditional): add `rider_shift_rosters` for date-specific
   schedules.** Needed only if shifts must be scheduled/cancelled per calendar
   date rather than treated as recurring standing assignments. The service
   would enforce daily zone/shift capacity transactionally by locking the
   existing `zone_shift_capacities` row and counting active assignments for
   that date. Do not apply without approval.

   ```sql
   CREATE TABLE rider_shift_rosters (
     id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
     rider_id            BIGINT UNSIGNED NOT NULL,
     zone_id             BIGINT UNSIGNED NULL,
     shift_id            BIGINT UNSIGNED NOT NULL,
     shift_date          DATE NOT NULL,
     status              ENUM('assigned','waitlisted','cancelled') NOT NULL,
     assigned_by         ENUM('system','admin') NOT NULL DEFAULT 'system',
     assigned_by_user_id BIGINT UNSIGNED NULL,
     reason              VARCHAR(255) NULL,
     created_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     UNIQUE KEY uq_roster_rider_shift_date (rider_id, shift_id, shift_date),
     KEY idx_roster_capacity (zone_id, shift_id, shift_date, status),
     CONSTRAINT chk_roster_zone
       CHECK (status <> 'assigned' OR zone_id IS NOT NULL),
     CONSTRAINT fk_roster_rider
       FOREIGN KEY (rider_id) REFERENCES rider_profiles (id),
     CONSTRAINT fk_roster_zone
       FOREIGN KEY (zone_id) REFERENCES zones (id),
     CONSTRAINT fk_roster_shift
       FOREIGN KEY (shift_id) REFERENCES shifts (id),
     CONSTRAINT fk_roster_assigned_by
       FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
   ) ENGINE=InnoDB;
   ```

5. **Proof timestamp:** `deliveries.delivered_at` supplies the server-side
   delivery/proof timestamp; `proof_lat` and `proof_lng` store the submitted
   rider coordinates. D5 must set these only after file validation and
   successful private storage. No additional capture-time column is required
   by the current prompt.

## 4. File storage, privacy, and local setup

### Storage contract

- Store all rider-uploaded files on the machine running Laravel, using the
  Laravel `private` local disk rooted at `backend/storage/app/private`.
- Paths only are persisted: `rider_documents.private_path` and
  `deliveries.proof_photo_path`. Never store file bytes, browser data URLs, or
  client filenames in the database.
- Use only server-generated random names and these directories:
  - `riders/{rider_id}/documents/{doc_type}-{random}.{ext}`
  - `deliveries/{delivery_id}/proof-{random}.{ext}`
- Rider profile photo, ID photo, driver's license, OR/CR, and delivery proof
  are all private. Do not create a public profile avatar or expose the private
  disk through `storage:link`.
- A private-file endpoint must first authorize the request, then stream the
  file or issue a signed, short-lived URL. A signature is not authorization
  by itself: authorize before issuing it. Validate the signature and expiry
  again when serving the URL.
- Access policy:
  - Admin may view rider application documents and delivery proofs.
  - The rider may view their own documents and proof for their own delivery.
  - The order's customer may view its delivery proof.
  - Restaurant staff may view proof only if their active membership has
    permission to view that order.
  - No other user may view a rider file. Deny with 403; do not reveal paths.
- Replace an uploaded document transactionally. After the new file and
  database update succeed, delete the replaced private file. On a failed
  database update, remove the newly written file and preserve the old one.
- Browser processing: correct orientation, resize longest edge to about
  1600 px, compress to about 2 MB or less, preview, progress indicator,
  Retake/Replace, and clear errors. Use a camera-capture input with a normal
  file-picker fallback. Only unsent text drafts may be kept in browser
  `localStorage`; never save wizard images there.
- Server processing: enforce a 2 MB limit; inspect real MIME using `finfo`;
  verify the allowed extension/MIME pairing; allow JPG/JPEG, PNG, and WebP
  images and PDF only for documents; decode and re-encode images with GD to
  verify image content and strip EXIF; reject fake MIME, malformed files,
  SVG, and path traversal. Never trust client MIME, filename, or path.
- Re-encode image formats to a canonical safe output and use the matching
  generated extension. Image-only profile/proof uploads reject PDF.
- Rejected rider application documents are removed after 30 days. Delivery
  proof retention reads `delivery_proof_retention_days` (starter value 30).
  Replacement cleanup and retention cleanup must not delete files referenced
  by another row. Add an orphan-file cleanup job scoped to rider-owned
  directories and old unreferenced files; log counts/errors without logging
  private paths or file contents.
- Files exist only on this computer unless the owner separately arranges
  backups. A new computer does not automatically receive them; file backups
  must be protected like the database.

### Windows/XAMPP local setup

1. Open `C:\xampp\php\php.ini` in a text editor. In the extensions section,
   enable `gd`, `fileinfo`, `openssl`, and `mbstring` (remove a leading `;`
   from the applicable `extension=` lines; do not add duplicate entries).
2. Set:

   ```ini
   upload_max_filesize=4M
   post_max_size=8M
   ```

   The upload limit allows multipart overhead around the rider's 2 MB
   compressed-file limit. Check both Apache PHP and CLI PHP: run `php --ini`
   from the backend terminal and make sure CLI uses the intended XAMPP
   `php.ini`.
3. Restart Apache in the XAMPP Control Panel after changing `php.ini`.
   Confirm the required extensions are enabled in both CLI and Apache PHP
   before testing image upload.
4. In `backend/.env`, use `FILESYSTEM_DISK=local` for the local private
   default. The existing filesystem config maps `private` to
   `storage/app/private` and `public` to `storage/app/public`; keep private
   files on the private disk. Do not put storage keys or credentials in
   frontend variables.
5. From `C:\xampp\htdocs\SALO\backend`, run
   `php artisan storage:link` only to expose the existing **public** disk at
   `public\storage`. This command is not a database migration. Windows may
   require an Administrator terminal or Developer Mode to create the
   symbolic link. Never link `storage\app\private`.
6. `backend\storage\app\private\.gitignore` already excludes private files.
   Keep that protection in place and verify uploads never appear in a public
   URL.
7. Local files are stored on this computer only. Preserve the private storage
   directory with an appropriately protected backup if the owner needs to
   retain files across reinstalls or computer changes.

### Upload/security test requirements

Run feature tests against guarded `salo_test` with `Storage::fake('private')`.
Do not run these tests until the test harness verifies the database name
before any refresh, setup, or query. Cover:

- Disallowed extension/MIME and mismatched extension/MIME.
- Files larger than 2 MB and a spoofed/fake MIME header.
- Corrupt/non-image bytes, valid image decode/re-encode, and EXIF metadata
  removal.
- Replacing a rider document deletes the previous file only after success.
- A non-owner cannot access another rider's document; non-participants cannot
  access delivery proof (403).
- Signed proof/document URL expires; a valid signature does not bypass policy
  when the URL is issued.
- Path traversal and attempt to supply a server-side path are rejected.
- Retention and orphan cleanup keep referenced files and delete only eligible
  private files.

## 5. Sample data command plan (not implemented or run in D0)

When a later approved phase needs hand-testing data, create explicit,
local-only artisan commands. They must require `APP_ENV=local`, never run
automatically, never be called by `db:seed`, print the complete rows and file
paths they intend to create, and require an interactive confirmation before
inserting. `--dry-run` prints that same plan and does not write anything.

Proposed command names:

```powershell
php artisan salo:rider-samples --dry-run
php artisan salo:rider-samples
php artisan salo:rider-samples:cleanup --dry-run
php artisan salo:rider-samples:cleanup
```

The eventual create command may prepare marked local records such as
`rider1@salo.test`, a sample zone, shifts, zone/shift capacities, a rider
profile and documents, and a ready delivery order with its customer,
restaurant, items, payment, and required status history. It must refuse to
run if any unique marker (including that email) already exists; it must not
update, adopt, or delete an existing row. The command should keep a private
manifest of the exact primary keys it inserted, and cleanup must delete only
those recorded rows in foreign-key-safe order. Cleanup must stop if records
have acquired unrelated references or if the manifest does not prove
ownership. The final implementation must show the exact planned inserts and
its dry-run output to the owner before the command is ever run. None of these
commands currently exists; no sample command or database operation was run
for D0.

## 6. Rider flows by phase

Each phase D1-D6 must include its own short responsive checklist in the
phase summary: widths actually checked, orientation/device/tool used, and
what was found. Do not infer testing from CSS breakpoints or claim a browser
or phone check that was not run.

### D1 — Application and activation

1. From Customer mode, start or resume one saved rider draft. A rider profile
   row is created at wizard start; text-only unsent drafts may be kept in
   browser storage, never uploaded images.
2. Ask vehicle type first: motorcycle, bicycle, e-scooter, or walker.
   Motorcycle-only license, OR/CR, and plate steps are omitted for other
   vehicles.
3. Collect the user's existing name, birthday (18+), phone, preferred shifts,
   PH home location using the shared Country/Province/City or Municipality/
   Barangay/Street/House number form, and an editable pin.
4. Collect private profile and ID photos; motorcycle applicants additionally
   provide professional driver's license and OR/CR. Collect e-wallet account
   name only, the clearance/TIN declaration, and rider-terms agreement.
5. Save draft progress; validate every field and file server-side before
   submission. The application states are `draft`, `submitted`,
   `under_review`, `needs_revision`, `approved`, and `rejected`. After
   submission show a status card, not an editable wizard. A submitted or
   under-review application cannot be duplicated. A revision request returns
   it for editing/resubmission and displays Admin notes.
6. Reuse the Admin application queue with a rider review detail/document
   viewer. Admin may start review, approve, reject with reason, or request
   revision with notes. Audit every decision.
7. Approval creates/updates the profile as `pending_activation`, runs the D2
   zone/shift assignment, and sends a rider-activation email OTP. Activate
   Driver mode only after verifying the single-use six-digit OTP. In local
   mode only, provide a copy-code helper; never expose OTPs outside local
   development.
8. Reject new applications from Business mode, active applications, or a
   resigned rider still inside the configured cooling-off period.

### D2 — Zones, shifts, and automatic scheduling

- Reuse Admin zone, shift, and capacity pages where they are database-backed;
  D0 found the current equivalents are fixture-backed and need persistence
  on the root schema.
- On approval, for each preferred shift, choose the nearest active zone with
  capacity, then the next-nearest within `max_zone_distance_km`; otherwise
  persist a waitlist assignment. Tie-break deterministically by zone ID.
- Lock the zone/shift capacity row and count assigned riders in one
  transaction. Recheck waitlist after resignation, suspension, or capacity
  increase and through a retry-safe scheduled job. Do not evict riders merely
  because capacity was lowered.
- Admin may override a rider's zone/shift with a reason; write an audit log.
- Rider sees assigned/waitlisted zones and shifts.
- D2 tests: full zone, nearest zone and deterministic tie-break, waitlist,
  waitlist recheck, override audit, and concurrent assignments never
  exceeding capacity.

### D3 — Rider shell, availability, and automatic dispatch

- Add Driver mode and a mobile-first shell with Home, Current delivery,
  Earnings, and Profile.
- Online is permitted only for an active rider, during an assigned shift, with
  location permission and no active-delivery conflict. Explain disabled
  reasons and support offline/retry states.
- Dispatch automatically when an eligible order reaches Ready or the
  configured earlier point. Select nearest eligible online/on-shift rider
  without an active delivery, lock the rider row, create one delivery and an
  offer attempt transactionally, and expose only a drop-off area before
  acknowledgement.
- Offer screen is full-screen, safe-area aware, and provides a countdown,
  pickup name/distance, approximate drop-off area, earning estimate, sound/
  vibration controls, and thumb-reachable Accept/Decline. Timeout/decline
  moves to the next rider, then neighboring zone, then notifies restaurant,
  customer, and Admin. No public job board.
- After acceptance, reveal pickup details, customer name/phone, exact address,
  delivery note, and order contents for that active delivery only.
- D3 tests: nearest eligible rider, atomic one-active-delivery rule,
  ineligible/busy riders skipped, timeout and decline retry, zone widening,
  and no-rider notifications.

### D4 — Map and live location

- Lazy-load Leaflet and camera code. Use the approved OSM/Leaflet setup only
  after verifying provider terms and attribution. Map contains rider,
  restaurant, customer, route to current target, distance, ETA, directions,
  and recenter control. Call `invalidateSize` on resize, orientation, and
  sheet snap changes.
- Keep only the latest rider point in Laravel cache, with a TTL of about two
  minutes. Post every 5-10 seconds during an active delivery; pause for
  hidden tabs, back off on errors, and clear the entry when delivery ends.
- Use a backend routing adapter with timeouts, caching, and an explicitly
  labeled straight-line estimate fallback. Provider keys stay in
  `backend/.env`; verify provider terms/limits before use.
- Handle denied/absent GPS and offline state with a clear retry and manual
  status path. Reject out-of-Philippines coordinates using the agreed coarse
  bounds setting.
- Customer tracking is authorized to that order's customer, authorized
  restaurant staff, and Admin. Display a stale-location notice when no point
  is newer than two minutes.
- D4 tests: unauthorized tracking 403, latest-point cache expiry and end of
  delivery deletion, out-of-bounds rejection, hidden-tab pause, and provider
  error fallback.

### D5 — Delivery lifecycle, proof, and cash

- Use only existing delivery states: `offered`, `accepted`, `picked_up`,
  `delivered`, `failed`, `cancelled`. Record order status history with actor
  and server time. Do not add persisted `at_restaurant` or `arrived` states.
- Picked up changes the order to `out_for_delivery`. Delivered requires a
  successful private proof upload plus server timestamp and rider
  coordinates, then changes the order to `delivered` and starts the existing
  customer receipt-confirmation flow. Pickup orders do not use rider proof.
- Failed requires a supported reason; notify relevant parties and let Admin
  review. Confirm before every delivery-changing action.
- COD collection must equal the authoritative order total. Record
  `cash_collected`; rider cannot mark cash remitted. Admin sets
  `cash_remitted` and an audit event.
- D5 tests: legal state transitions, valid proof required, file type/size/
  fake-MIME rejection, proof URL authorization and expiry, COD exact amount,
  and Admin-only remittance.

### D6 — Earnings, history, profile, resignation

- Show today, this week, this month, and lifetime earnings, delivery count,
  chart, and cash-to-remit. Per-delivery earning is the server-computed
  delivery fee times `rider_share_percent`, stored at completion; totals are
  sums, not stored summaries. Display payout account name only.
- History detail after completion shows area only, never customer phone or
  exact address.
- Profile changes include photo, phone, vehicle, home location, and preferred
  shifts. Sensitive fields require confirmation; plate/document changes
  return to Admin review. Keep all uploaded files private.
- Resign requires no active delivery and settled cash. Require password,
  show specific blockers and consequences, set `resigned` and `resigned_at`,
  release shift capacity, recheck waitlist, retain delivery history, and
  remove Driver mode.
- Admin suspension forces Offline and returns any active order to dispatch;
  reinstatement remains an audited Admin action.
- D6 tests: earnings aggregate, resignation blocked by active delivery or
  unsettled cash, suspension redispatch, profile isolation, and no
  post-completion access to customer contact/address.

### D7 — QA and final report

Run the complete authorized test suite only after the guarded `salo_test`
harness is verified. Report suite counts and all failures. Check rider pages
at 360, 390, 768, and 1280 px; also include the addendum's full matrix below.
Use a real phone over HTTPS or localhost for camera and GPS, and keyboard-only
desktop checks. Final report maps every route to its policy, every plan rule
to service and test, scheduler jobs, cache keys, pending schema proposals,
assumptions, and deferred work.

## 7. Proposed rider API contract

All paths below are under `/api/v1`. The D0 audit found no database-backed
rider API. Except where marked **Existing route, not rider-complete**, these
are proposed contracts for later phases, not implemented endpoints. JSON keys
are `snake_case`; normal success is `{ "data": ... }`, paginated responses add
`meta`, and validation uses the Laravel JSON validation envelope. Do not
accept `user_id`, `rider_id`, file paths, order totals, or role/capability
values as authority from the client.

### Applicant and activation

| Method and URL | Request -> response | Who may call and rules |
|---|---|---|
| `POST /applications/riders` | Empty or initial draft fields -> `201` own rider-profile draft resource | Authenticated Customer mode only. Create/reuse the caller's single draft; reject Business mode, active application, active rider, and cooling-off Resigned rider. Never create a second account. |
| `GET /applications/riders/mine` | Optional pagination -> own rider application and current status | Authenticated applicant only; return no other applicant data. |
| `GET /applications/riders/{rider}` | None -> own draft/review/status resource, including applicant-visible notes | Authenticated owner of that RiderProfile only. |
| `PATCH /applications/riders/{rider}` | Allowed draft/revision fields -> updated own draft | Applicant only while `draft` or `needs_revision`. Validate vehicle-dependent fields, age, shifts, PH home address, declarations, and status. |
| `POST /applications/riders/{rider}/documents` | Multipart `file`, `doc_type` -> document metadata only | Applicant owns a draft/revision profile. Permit only `profile_photo`, `id_photo`, `drivers_license`, `or_cr`; enforce vehicle rules and private upload policy. Never return private path or public URL. |
| `DELETE /applications/riders/{rider}/documents/{document}` | None -> `204` | Applicant owns editable application; document must belong to that profile. Delete only the targeted stored file after DB delete succeeds. |
| `GET /applications/riders/{rider}/documents/{document}/download-url` | None -> short-lived signed URL | Applicant may access own file; Admin can access via Admin policy. Authorize before signing. |
| `POST /applications/riders/{rider}/submit` | Confirmation/declaration -> submitted resource | Applicant only; server validates all required fields/files, 18+, motorcycle requirements, and switches status atomically to `submitted`. |
| `POST /admin/applications/rider/{rider}/start-review` | Optional note -> under-review resource | Admin capability only; record audit. Reuse queue behavior, but persist against rider profile rather than restaurant application repository. |
| `POST /admin/applications/rider/{rider}/approve` | Optional note -> approved profile with `pending_activation` and assignment result | Admin only; transactionally approve, assign/waitlist shifts, audit, issue OTP, and trigger mail. If mail fails, retain valid pending activation and surface/retry the send failure; do not expose secrets. |
| `POST /admin/applications/rider/{rider}/reject` | Required `note` -> rejected application resource | Admin only; audit and schedule private documents for 30-day deletion. |
| `POST /admin/applications/rider/{rider}/request-revision` | Required `note` -> needs-revision resource | Admin only; audit and make allowed fields/documents editable to applicant. |
| `POST /applications/riders/{rider}/activation/otp` | None -> generic sent response | Authenticated owner with `pending_activation`; rate-limit, bind OTP to rider/user email, follow platform settings. Return local-only copy helper only in local environment. |
| `POST /applications/riders/{rider}/activation/verify` | `{ "code": "000000" }` -> active rider capability/profile | Authenticated owner with `pending_activation`; verify hashed, single-use `rider_activation` OTP, expiry, attempt count, and target; atomically activate and audit. |

Admin list/detail use the existing route shapes
`GET /admin/applications?type=rider` and
`GET /admin/applications/rider/{id}`. The current generic Admin application
implementation is not a persistent rider review workflow; later work must
authorize and load RiderProfile/documents directly. Existing application
document signed routes are for application documents and are not sufficient
to authorize rider document paths.

### Active rider, dispatch, and delivery

| Method and URL | Request -> response | Who may call and rules |
|---|---|---|
| `GET /rider/home` | None -> online state, active shift/zone, today's earnings, next action, current delivery or offer | Active, OTP-activated rider only; own data. |
| `GET /rider/profile` | None -> own rider profile and safe document metadata | Active rider; no private paths, no other rider data. |
| `PATCH /rider/profile` | Allowed profile fields -> updated profile/status | Own rider only. Sensitive vehicle/plate/document changes may require Admin review; never accept status, availability, earning, or approval fields. |
| `GET /rider/shifts` | Optional current/future filter -> own preferred and assigned/waitlisted shifts | Active or pending applicant as appropriate; no other riders' assignments. |
| `PUT /rider/availability` | `{ "availability": "online" \| "offline" }` -> updated own availability | Active, activated rider. Going Online requires current assigned shift, location permission/current point, and no active-delivery conflict. |
| `GET /rider/offers/current` | None -> at most one pending offer with safe pickup/drop-off area, estimate, and server deadline | Online active rider only; no exact customer address/phone until accepted. This is polling for an assigned offer, not a job board. |
| `POST /rider/offers/{offer}/accept` | Empty -> accepted offer and active delivery summary | The offered rider only; lock offer, delivery, and rider; enforce unexpired offer and one active delivery. Return full customer/pickup detail only after commit. |
| `POST /rider/offers/{offer}/decline` | `{ "reason"?: string }` -> declined state | Offered rider only; record response and start next dispatch attempt. |
| `GET /rider/deliveries/current` | None -> current delivery with customer contact/address and order items | Active assigned rider only; return nothing if no active delivery. |
| `GET /rider/deliveries/{delivery}` | None -> delivery/order detail | Assigned rider only while active. After completion, return history-safe detail without phone/exact address. |
| `POST /rider/deliveries/{delivery}/location` | `{ "latitude", "longitude", "accuracy_m"?: number }` -> `{ "recorded_at", "expires_at" }` | Assigned rider for an active delivery only. Validate coarse PH bounds and finite coordinate ranges. Ignore client timestamp; write only latest point to cache with TTL; no DB row/history. |
| `POST /rider/deliveries/{delivery}/picked-up` | Empty -> updated delivery and order status/history | Assigned rider with accepted delivery only; transition once to `picked_up` and order `out_for_delivery`. |
| `POST /rider/deliveries/{delivery}/delivered` | Multipart image `proof`, `latitude`, `longitude` -> delivered status/history and proof metadata (not path) | Assigned rider with `picked_up` delivery only. Validate/re-encode/store private proof, use server timestamp, persist path/coordinates and order `delivered` transactionally, then trigger customer receipt flow. |
| `POST /rider/deliveries/{delivery}/failed` | `{ "reason": "customer_unreachable" \| "wrong_address" \| ... }` -> failed state and dispatch/admin result | Assigned rider only; reason required, audit/history/notifications; protect customer location/contact after assignment ends. |
| `POST /rider/deliveries/{delivery}/cash-collected` | `{ "amount": number }` -> cash-collected amount | Assigned rider on COD delivery only; compare to authoritative order total server-side. Rider cannot set `cash_remitted`. |
| `GET /rider/history` | Date/status/page filters -> paginated completed/failed history | Authenticated rider owns all results; completed detail includes area only, never phone/exact address. |
| `GET /rider/earnings` | `period=today\|week\|month\|total` -> totals, count, cash-to-remit, chart points | Authenticated rider; derive totals from own completed deliveries. |
| `POST /rider/resign` | `{ "password": "..." }` -> resigned profile or explicit blockers | Active rider only; require password, no active delivery and all cash settled; set status/time, audit, release capacity and recheck waitlist atomically. |

### Customer tracking, Admin, and private files

| Method and URL | Request -> response | Who may call and rules |
|---|---|---|
| `GET /customer/orders/{order}/tracking` | Existing route; return order status/timeline plus latest cached rider point, stale marker, route/ETA where available | **Existing route, not rider-complete.** Order's customer only; authorized restaurant staff and Admin may use their applicable tracking route/policy. Never return another order's location. |
| `GET /admin/riders/{rider}/proofs` | Existing route; paginated proof metadata | **Existing route, fixture-backed.** Admin only; later implementation loads the rider's private deliveries and authorizes each streamed/signed file. |
| `PATCH /admin/riders/{rider}/status` | `{ "status": "suspended" \| "active", "reason"?: string }` -> updated profile | **Existing route, fixture-backed.** Admin only; audit. Suspension forces offline and safely returns any active delivery to dispatch. |
| `GET /rider/documents/{document}/file` | Signed short-lived URL or streamed file | Rider owner or Admin only; controller rechecks authorization and path stays under private root. |
| `GET /deliveries/{delivery}/proof/file` | Signed short-lived URL or streamed file | Admin, owning rider, that order's customer, or restaurant staff with order permission only. Sign only after policy authorization and recheck signature expiry. |
| `POST /admin/deliveries/{delivery}/cash-remitted` | `{ "remitted": true }` | Admin only; update remittance flag once and write audit log. |

Use explicit FormRequests, thin controllers, services/actions, Eloquent
repositories, resources, and policies. All rider endpoints require
`auth:sanctum` plus the correct capability/profile/ownership policy. A
frontend route guard is not authorization. Return 401 unauthenticated, 403
unauthorized, 404 for non-disclosing inaccessible records where appropriate,
and 422 for invalid state/validation. Never log OTPs, private URLs, exact
addresses outside active delivery audit requirements, or uploaded file bytes.

## 8. Cache contract and scheduled work

### Live-location cache

- Key: `salo:rider:delivery-location:{delivery_id}`.
- Value: `rider_id`, `latitude`, `longitude`, optional `accuracy_m`, and
  server-generated `recorded_at` (ISO-8601 UTC). Do not store a location
  history, user ID beyond the assigned rider reference, or a client timestamp.
- TTL: 120 seconds (or the approved equivalent). Each accepted location
  replaces the previous value. Delete immediately when delivery ends, is
  cancelled, fails, is reassigned, or rider becomes ineligible.
- The cache key is not itself access control. Resolve the delivery and apply
  the order/customer/restaurant/Admin policy before returning a value.
- Current `config/cache.php` supports file/database/array stores; rider
  production behavior must use a persistent cache with TTL. The `array` store
  is test-only and does not persist across requests. Do not put live locations
  in SQL or localStorage.

### Rider jobs to add later

| Job | Trigger/frequency | Required behavior |
|---|---|---|
| Zone waitlist recheck | When capacity frees/increases; periodic retry-safe sweep | Lock capacity row, assign nearest eligible waitlisted riders without exceeding capacity, audit manual overrides. |
| Delivery-offer timeout/retry | Delayed job at offer deadline plus a periodic recovery sweep | Compare server deadline with `rider_ack_seconds`, mark timeout once, offer to next eligible rider/neighboring zone, notify parties if exhausted. |
| Rejected rider document retention | Daily | Delete rejected-application private documents after 30 days and remove their rows only when no longer needed; retry safely. |
| Delivery-proof retention | Daily | Delete proof files/paths after `delivery_proof_retention_days` and approved retention date; do not remove other rider documents. |
| Orphan private-file cleanup | Daily | Remove only old unreferenced files under rider-owned private directories; preserve referenced/in-flight files and report safe counts. |
| Clear ended-delivery location | On every terminal/end/reassign path; TTL as crash fallback | Delete cache key immediately; rely on TTL only if process termination prevents explicit cleanup. |

Existing scheduled jobs include team-invitation expiry, audit pruning, menu
quantity reset, unanswered Business-order cancellation, pending reservation
expiry, and Customer cart expiry. They are not rider jobs. Queue/scheduler
execution and external email delivery require runtime configuration and have
not been verified in D0.

## 9. Responsive layout plan and acceptance

Use existing design tokens in `src/styles/global.css` and existing shared
components in `src/components/ui/`; do not recreate global styles. Rider
styles belong in rider-specific CSS, with BEM class names prefixed `rider-`,
mobile-first rules, and `min-width` media queries only. Use no hard-coded
colors, `!important`, or static inline styles. Runtime-computed styles are
allowed only for actual dynamic values. Reuse Button, Card, Input, Badge,
Sheet, Modal, Tabs, Table, Skeleton, EmptyState, and ErrorState where suitable.

| Page/component | Phone (<768 px) | Tablet (768-1023 px) | Desktop (1024 px and up) |
|---|---|---|---|
| Application wizard/status | Single column, sticky progress/header and footer, 16 px minimum inputs, inline errors, camera controls/safe area, no horizontal scroll | Single-column form with compact surrounding context | Existing sidebar/top-bar shell, form constrained to content max-width |
| Admin rider application/document review | Applicant details as stacked cards; document viewer full-width/accessible modal, no private-photo overflow | Two-pane application list/detail where space allows | Dense data-friendly application table and document review panel |
| Rider home/dashboard | One-column cards; bottom nav for Home, Current delivery, Earnings, Profile; solid readable metrics | Navigation rail and two-pane dashboard | Existing sidebar/top bar, dashboard grid, constrained content |
| New delivery offer | Full-screen overlay, countdown ring, safe-area padding; Accept/Decline thumb reachable | Compact header and offer details in side panel | Overlay/card in shell, clear countdown and actions |
| Active delivery/map | Full-height map with explicit flex height and draggable bottom sheet (collapsed/half/full); sticky bar has exactly one primary thumb-zone action | Map left, details/controls right; landscape phone uses this arrangement with compact header | Existing shell with map/details panes and content max-width |
| Camera/proof | Full-screen aspect-locked viewfinder, shutter/Retake in thumb zone, safe areas, landscape support, capture input fallback | Camera and details side-by-side when appropriate | Accessible modal/panel; camera code lazy-loaded |
| Earnings/history | Cards and responsive chart at 360 px; area-only completed history | Table from 768 px with filters | Dense sortable table and responsive chart |
| Rider profile/resign | Single-column form, sticky safe-area actions, explicit confirmations and blockers | Two panes only where fields remain readable | Existing shell, data-friendly profile and history panels |
| Offline/error/loading states | Visible offline banner, skeleton/empty/error/retry states; no hover-only actions | Same state coverage with rail layout | Same state coverage in desktop shell |

Global requirements on every Rider page/component:

- Include `<meta name="viewport" content="width=device-width, initial-scale=1,
  viewport-fit=cover">`; use `100dvh`, never plain `100vh`, and respect
  `env(safe-area-inset-*)` on navigation, sticky bars, camera, and offers.
- Base layout is 360 px; test 480, 768, 1024, 1280 boundaries and fluid type
  with `clamp()`. Keep spacing on the token scale and prevent horizontal
  scrolling.
- Touch targets are at least 48 px with at least 8 px spacing; buttons use
  `touch-action: manipulation`. Sheets/modals contain overscroll and lock body
  scroll while open.
- Outdoor contrast: normal text at least 4.5:1; ETA, distance, countdown, and
  earnings at least 7:1. Primary numbers at least 20 px. No small text on
  low-opacity glass; use solid surfaces for actions and data.
- Forms use correct input `type`, `inputmode`, `autocomplete`, and
  `enterkeyhint`; labels/errors are explicit; no sideways scroll.
- Leaflet has an explicit flex height, invalidates size after resize,
  orientation, and sheet snap changes; marker hit areas at least 44 px;
  attribution remains visible without covering controls.
- Provide online/offline event handling, reduced-motion and
  reduced-transparency fallbacks, visible `:focus-visible` rings, and image
  `aspect-ratio`. Lazy-load map/camera chunks; avoid layout shift.
- No hover-only actions. Support keyboard navigation and meaningful status
  text independent of color.

### Verification record

No responsive widths were checked for D0. No browser developer-tools device
mode, Playwright viewport, real phone, HTTPS tunnel, camera, or GPS verification
was run. D0 is documentation-only; this is not a claim that any acceptance
viewport passed.

For D1-D6 summaries, record actual results from this matrix (not intended
results):

| Viewport | Required check |
|---|---|
| 360x640 | Smallest supported phone; safe-area action controls, no horizontal scroll |
| 390x844 | Common phone; form and bottom navigation |
| 412x915 | Large phone; offer/map/camera thumb reach |
| 768x1024 portrait | Tablet split/navigation rail |
| 768x1024 landscape | Map left, controls right, compact header |
| 1024 px | Desktop shell breakpoint/layout |
| 1280 px | Desktop dashboard/table/map layout |
| 1920 px | Wide-screen content max-width and dense data pages |

Record which exact browser/tool/device was used, viewport dimensions,
orientation, findings, and untested behavior. D7 additionally requires a real
phone over HTTPS or localhost to grant camera and geolocation permissions,
then verify denied-permission and offline fallbacks. Do not claim real-device
coverage from desktop simulation.

## 10. D0 exit checklist

- [x] Read the driver prompt, supplied addendum text, Plan v2, and root SQL.
- [x] Audit auth/OTP/modes, permissions, Admin rider queue, zones/shifts,
  orders/tracking, notifications, email support, local storage, and test
  configuration from source.
- [x] Record rider schema fit and conditional schema proposal without applying
  changes.
- [x] Document rider flows, endpoint contract, cache keys, scheduler jobs,
  private file design/setup, sample command plan, and responsive layouts.
- [x] No code changes, migrations, tests, live database connections, or sample
  data operations were performed.
- [ ] Stop for owner review before D1.
