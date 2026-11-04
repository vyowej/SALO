# SALO Driver (Rider) Side

**Status:** D0 through D3 have been implemented, with phase-specific
verification recorded below. D1-D3 changes use the
guarded `salo_test` database only; no migration or schema edit was made. The owner states that
the live MariaDB 10.11 database `salo` is connected and was imported from the
root schema. This document treats that as an operating constraint, not as a
claim that D0 independently verified the connection.

## 1. Authority, scope, and safety

Read together for this audit:

- [Driver-side implementation prompt](./driver-side-v2.md)
- [Driver-side addendum](./prompts/driver-side-addendum.md) (its content was
  supplied in the conversation; the file itself was not found in this checkout)
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
- Recurring zone/shift membership uses `rider_shift_assignments`. The owner
  declined date-specific shift rosters; no rider feature currently requires
  that schema addition.
- Tests use only the separately guarded `salo_test` database and a fake file
  disk. Before any test touches a database, both the configured database name
  and `SELECT DATABASE()` must end in `_test`; a mismatch must fail closed.
- Files uploaded by riders are private local-disk files. Do not put an image,
  file data URL, or image blob in browser `localStorage`.
- D0-D3 are complete as recorded below. D4 and later phases remain separately
  gated.

## 2. D0 prerequisite audit

This is a repository/source audit. F2 performed only the guarded loader's
read-only database preflight; it did not inspect rider data or execute SQL
statements. No mail server, browser device mode, or phone was used.

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
   `delivery_proof_retention_days`, `rejected_doc_retention_days`,
   `max_zone_distance_km`, and `rider_reapply_cooldown_days` are present in the
   root SQL or were added to live platform settings by the owner. Application
   code reads the live settings; D0 did not run inserts. No settings/schema
   proposal is needed.
4. **Recurring shifts:** use `rider_shift_assignments` keyed by rider and
   shift. The owner declined date-specific rosters; no rider feature currently
   requires a schema addition.
5. **Proof timestamp:** `deliveries.delivered_at` supplies the server-side
   delivery/proof timestamp; `proof_lat` and `proof_lng` store the submitted
   rider coordinates. D5 must set these only after file validation and
   successful private storage. No additional capture-time column is required.

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

### D1 implementation record

- Implemented the API-backed applicant wizard, database-backed draft resume,
  Admin rider review actions, email OTP approval/activation, and private
  document access. All changes use existing tables; no schema proposal was
  needed or applied.
- Motorcycle-only license, OR/CR, and plate fields are enforced. The server
  calculates the submitted formatted address from a barangay-level PSGC code,
  street, and optional house number.
- Zone/shift assignment is intentionally not run by D1. The approval flow
  leaves assignment to D2, as authorized by the phase boundary.
- The signed document endpoint authorizes the rider owner or an active Admin
  before issuing a five-minute URL, then repeats the policy check while
  streaming. Private paths are never returned by applicant or Admin resources.
- Draft progress is inferred from server-persisted fields and uploaded
  document metadata. Only unsent text drafts may use browser storage; images
  and document contents remain on Laravel's private local disk.
- The wizard compresses and resizes images in the browser, previews selected
  files, reports upload progress, and supports replace/retake and camera or
  file-picker input. The API validates file content and stores server-generated
  private paths.
- Responsive checklist: the signed-out `/rider/apply` route was checked with
  integrated-browser viewport emulation at 360x640, 390x844, 412x915,
  768x1024 portrait, 1024x768 landscape, 1280x800, and 1920x1080. No
  horizontal overflow was observed at those viewports. The authenticated
  wizard, upload/camera overlay, and Admin review detail were not available
  in that browser session and are not claimed as verified.

### D2 — Zones, shifts, and automatic scheduling

- Uses the existing `zones`, `shifts`, `zone_shift_capacities`,
  `rider_preferred_shifts`, `rider_shift_assignments`, `platform_settings`,
  and `audit_logs` tables. No table, column, status, or migration was added;
  recurring rider/shift assignments remain in use.
- Replaced the fixture-backed Admin schedule view with database-backed zone,
  shift capacity, assignment, override, and rider operating-status controls.
  Admin routes require the scheduling policy and write an audit record for
  zone, capacity, override, and rider-status changes.
- On approval and activation, preferred shifts are scheduled by distance to
  each active zone with capacity within `max_zone_distance_km`; exact distance
  ties are resolved by zone ID. Missing coordinates, no eligible capacity,
  or full zones create a waitlisted assignment with a reason.
- Assignment locks the zone/shift capacity row and checks assigned riders
  within a transaction. Increasing capacity or activating a zone retries the
  waitlist; suspending a rider releases assigned slots and retries it.
  Lowering capacity does not evict riders. The retry command is scheduled
  every five minutes.
- The rider's own profile/status resource includes assigned and waitlisted
  recurring shifts. This phase does not implement online delivery dispatch,
  offers, or delivery-job handling; those remain D3.
- Verification: focused `RiderSchedulingTest` passed (10 tests, 32
  assertions). The full backend suite passed (154 tests, 988 assertions).
  `npm run lint`, `npm run build`, and PHP syntax checks for changed PHP files
  passed. The test database was verified as `salo_test`; post-run counts were
  zero for `users`, `rider_profiles`, `zones`, `rider_shift_assignments`,
  `zone_shift_capacities`, and `audit_logs`. The existing
  `max_zone_distance_km=10` setting and all 3 shifts remained.
- Responsive checklist: the Admin scheduling stylesheet was reviewed and the
  production frontend build passed. Its base layout is single-column, with
  token-based breakpoints at 30rem, 48rem, and 64rem and 48px controls.
  No D2 authenticated page was visually checked at a matrix viewport; the
  available browser session was signed out, so no viewport width is claimed
  as verified for this D2 interface.

### D3 — Rider shell, availability, and automatic dispatch

- The database-backed Driver shell replaces the rider job-board mock with
  Home, Current delivery, Earnings, and Profile navigation. Demo mode retains
  an isolated in-memory offer; API mode uses the authenticated Driver routes.
- Going Online requires an active, approved rider, a currently assigned zone
  and shift, and one browser location snapshot. The latest coordinates live
  only in Laravel cache for two minutes; they are not stored in the database
  or updated continuously. Offline, mode exit, suspension, shift ineligibility,
  or location expiry clears the cached point.
- Rider shift windows are evaluated using `Asia/Manila` local time even though
  Laravel's application timezone is UTC. The shift start is inclusive and the
  shift end is exclusive; Driver readiness, Go Online validation, and dispatch
  eligibility use the same local-time comparison. Overnight windows are
  handled as wrapping midnight if present, although the authoritative schema
  currently disallows shifts whose end is earlier than their start.
- Only delivery orders with a COD payment are dispatched at `ready`. Active
  zones matching the restaurant PSGC are prioritized; if none match, zones
  containing the restaurant within their configured radius are prioritized.
  Remaining active zones are widened in center-distance order, without an
  additional distance cap. The nearest eligible rider is chosen by cached
  rider-to-restaurant distance, then rider ID.
- The order and rider rows are locked during offer creation. A rider cannot
  hold two active offers/deliveries. Each rider is offered each delivery at
  most once; timeout uses `rider_ack_seconds` (60 seconds), with no numeric
  attempt cap. Declines and timeouts retry the next eligible rider and then
  widen zones. Unassigned deliveries remain `offered`; the customer,
  restaurant owner/staff, and active Admin are notified once per order and
  dispatch retries when eligibility changes.
- Before acceptance, the offer contains only pickup name/distance, estimated
  earning, order reference, and an approximate drop-off area. The authenticated
  rider who owns the current offer can accept or decline it. Exact pickup and
  customer details are returned only for that rider's accepted/picked-up
  delivery and are unavailable after it ends.
- Cancellation, Driver-mode exit, suspension, loss of eligibility, and offer
  timeout are integrated. Reassignment is limited to before `picked_up`;
  post-pickup recovery remains for a later authorized phase. Only the existing
  delivery statuses are used.
- The one-off scheduled command expires offers and stale locations, then
  retries ready delivery orders every minute. No database schema changes or
  numbered schema proposals were needed.
- Verification: focused backend `RiderDispatchTest` passed (9 tests, 48
  assertions), including concurrent two-order dispatch through separate
  processes. The full guarded suite passed (172 tests, 1,108 assertions,
  37.16 seconds). Frontend Rider and App tests passed together (9 tests).
  `npm run lint` and `npm run build` passed. A broader `npx vitest run` also
  finds the existing `src/constants/voice.test.js`, which has no test suite;
  that file is outside the configured `npm test` command and was not changed.
  The test target was confirmed as MySQL `salo_test` by configuration and
  read-only `SELECT DATABASE()`. Post-run read-only checks showed 0 users,
  restaurants, and orders, 0 dispatch fixture rows, and retained `Morning`,
  `Afternoon`, and `Evening` shifts plus `rider_ack_seconds=60` and
  `rider_share_percent=80`. No migration, loader, DDL, seeder, or live `salo`
  operation was run.
- Responsive checklist: browser device-mode checks used the Rider demo account
  at `http://127.0.0.1:5174/rider` in mock/demo mode at 360x800, 390x844,
  412x915, 768x1024 portrait, 1024x768 landscape, 1024x900, 1280x800, and
  1920x1080. The Rider tabs were also checked at 360px.
  No horizontal overflow, overlap, or visible clipping was found; the 360px
  greeting wrapped to two lines and the wide desktop content remained
  centered. The temporary server was stopped. The requested 360x640 and 768
  landscape sizes were not checked. These were mock-mode visual checks, not a
  real-device or live API test.

### D4 — Map and live location

- Reuse the existing Leaflet dependency and visible OpenStreetMap attribution;
  no new map dependency, provider, or key was added. Both map surfaces use the
  canonical `https://tile.openstreetmap.org/{z}/{x}/{y}.png` URL specified by
  the current OSM Tile Usage Policy. OSM's public tile service is best-effort
  without an availability SLA; production deployment must still preserve a
  valid Referer and honor tile caching requirements, and has not been approved
  or tested here. Keep the visible attribution. There is no in-app road router,
  route geometry, distance, or ETA provider. The rider can hand off the
  destination to Google Maps or Waze; do not treat the handoff as verified
  route data.
- The mobile active-delivery view uses the available map area with a draggable
  details sheet that snaps collapsed, half, or full, plus one thumb-zone
  navigation action. Tablet and desktop layouts put the map beside delivery
  details. The D4 view does not add delivery-progress controls.
- The rider browser starts `watchPosition` only in Driver mode for its own
  `accepted` or `picked_up` delivery. Updates are throttled to no more than
  one request per five seconds. Hidden tabs pause and clear the server point;
  permission denial, unavailable GPS, upload errors, ineligibility, and retry
  are visible. A 403/404 from the location endpoint stops the active watch,
  blocks further submissions from queued callbacks, and clears local tracking
  state; temporary network errors leave the watch active. No watch runs while
  Online and idle.
- `POST /api/v1/driver/deliveries/{delivery}/location` validates coordinate
  ranges and requires the authenticated active rider to own the assigned
  active delivery. It writes the latest coordinate and server timestamp to
  Laravel cache only; it performs no coordinate database write.
- Customer `GET /api/v1/customer/orders/{order}/tracking` is available only
  through the existing owned-order lookup and policy. It returns a location
  only while the order's delivery is accepted/picked-up and the assigned rider
  remains active. Completed, cancelled, failed, unassigned, or ineligible
  deliveries return no rider point. Customer response contains coordinates
  and timestamp only, not rider contact or profile details.
- Switching away from Driver mode, logging out, becoming ineligible, clearing
  location, or cancelling an order clears the rider cache. A tracking read
  also clears an ended/ineligible delivery's entry; the two-minute TTL is the
  crash/recovery fallback. The existing dispatch snapshot and delivery-scoped
  key contain the same latest point only; there is no location history.
- D4 tests cover owner-only rider updates, invalid coordinates, customer
  order ownership, latest-point replacement, cache expiry, terminal delivery
  privacy, cache-only writes, logout cleanup, terminal cleanup with and without
  a retained rider ID, ineligible GPS stop, temporary network errors, and
  watcher retry without duplication. Focused backend tests passed (22 tests,
  109 assertions); the full backend suite passed (191 tests, 1,234 assertions).
  Configured frontend tests including Rider and Customer tracking passed (17
  tests); lint and production build passed.
- Mock-mode browser simulation covered 360x800, 390x844, 768x1024, and
  1280x800. It verified the canonical tile request host, clearWatch on
  ineligibility, no request from a queued GPS callback after stop, and one
  fresh watcher on retry. OSM tile requests were aborted, so successful tile
  rendering remains unverified. This simulation does not verify physical
  device GPS permissions, background behavior, or production hosting policy.

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

## 7. Rider API contract

All paths below are under `/api/v1`. Applicant, activation, Admin-review, and
private rider-document rows are implemented in D1; later-phase rider APIs
remain proposed. JSON keys are `snake_case`; success uses `{ "data": ... }`,
paginated responses add `meta`, and validation uses the API error envelope.
Never accept `user_id`, `rider_id`, file paths, order totals, or
role/capability values as authority from the client.

### Applicant and activation

| Method and URL | Request -> response | Who may call and rules |
|---|---|---|
| `POST /applications/riders` | Empty body -> `201` new or `200` existing own draft resource | Authenticated Customer mode; create/reuse the caller's single profile, enforce cooldown on rejected/resigned applicants. |
| `GET /applications/riders/mine` | None -> own application resource | Authenticated applicant only. |
| `GET /applications/riders/{rider}` | None -> own profile, address, shifts, document metadata, and review notes | Authenticated owner only; another rider's ID returns `404`. |
| `PATCH /applications/riders/{rider}` | Draft fields (`vehicle_type`, applicant name/birthday/mobile, `preferred_shift_ids`, `psgc_code`, street/house, map coordinates, plate, e-wallet name, declaration) -> updated resource | Applicant only in `draft` or `needs_revision`; birthday must be 18+, PSGC code must resolve to a barangay, and shifts must exist. |
| `POST /applications/riders/{rider}/documents` | Multipart `doc_type` and `file` -> document metadata only | Applicant owns an editable profile. Allow only rider document types; motorcycle-only documents require motorcycle. Check 2 MB, real MIME and matching extension; re-encode image uploads to JPEG on private disk. |
| `DELETE /applications/riders/{rider}/documents/{document}` | None -> `204` | Applicant owns editable application; the document must belong to that rider. |
| `GET /applications/riders/{rider}/documents/{document}/download-url` | None -> five-minute signed URL | Applicant owner only; authorize before signing. |
| `GET /private/rider-documents/{document}` | Signed URL -> private stream | Requires valid, unexpired signature and a fresh owner/Admin authorization check. |
| `POST /applications/riders/{rider}/submit` | `{ "terms_accepted": true }` -> submitted resource | Applicant only; validate required fields/files and motorcycle requirements, format address server-side, then save status and audit atomically. |
| `GET /admin/applications?type=rider` and `GET /admin/applications/rider/{id}` | Filters/detail -> queue or rider resource | Active Admin only. |
| `GET /admin/riders/{rider}/documents/{document}/download-url` | None -> five-minute signed URL | Active Admin only; document must belong to rider. |
| `POST /admin/applications/rider/{rider}/start-review` | Optional `note` -> under-review resource | Active Admin only; record audit. |
| `POST /admin/applications/rider/{rider}/approve` | Optional `note` -> `{ "profile": ..., "email_delivery": ... }` | Active Admin only; transactionally approve, audit, issue the activation OTP, and attempt notification. Zone/shift assignment is deferred to D2. |
| `POST /admin/applications/rider/{rider}/reject` | Required `note` -> rejected resource | Active Admin only; audit; private files are pruned after the configured retention period. |
| `POST /admin/applications/rider/{rider}/request-revision` | Required `note` -> needs-revision resource | Active Admin only; audit and allow applicant edits/resubmission. |
| `POST /applications/riders/{rider}/activation/otp` | None -> sent/result message, local-only copy code in local environment | Authenticated owner in `pending_activation`; throttle, cooldown, and bind to the account email. |
| `POST /applications/riders/{rider}/activation/verify` | `{ "code": "000000" }` -> active rider resource | Authenticated owner in `pending_activation`; verify hashed, single-use OTP, expiry, and attempt limit; activate and audit atomically. |

Admin list/detail and review actions reuse the existing generic Admin route
shapes, but rider records are loaded from the rider repository and checked by
the rider review policy. Approval returns `email_delivery.sent=false` and a
logged error message when mail fails; OTP secrets are never logged or returned
outside local development. No D1 route returns a raw private path.

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
| `POST /api/v1/driver/deliveries/{delivery}/location` | `{ "latitude", "longitude" }` -> `{ "recorded_at", "expires_at" }` | Authenticated Driver-mode rider assigned to an `accepted` or `picked_up` delivery; validate coordinate ranges and write latest point only to cache. |
| `DELETE /api/v1/driver/deliveries/{delivery}/location` | Empty -> `{ "cleared": true }` | The assigned rider; used when GPS is unavailable, the page is hidden, or tracking ends. |
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
| `GET /api/v1/customer/orders/{order}/tracking` | Existing order status/timeline plus latest cached rider point when the assigned delivery is active | The order's customer only. Existing order ownership query and policy run before location access; no location is returned after delivery ends or the rider becomes ineligible. |
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

- Delivery-scoped key:
  `rider:delivery:{delivery_id}:profile:{rider_id}:location`.
- Value: `latitude`, `longitude`, and server-generated `updated_at`
  (ISO-8601). A same-value latest-point mirror at
  `rider:{rider_id}:dispatch-location` maintains D3 eligibility behavior.
  Neither key stores history or a client timestamp.
- TTL: exactly 120 seconds. Each accepted update replaces the previous point.
  Clear both keys when delivery ends/cancels, location is explicitly stopped,
  the rider logs out/switches mode, or the rider becomes ineligible.
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

## 10. F2 guarded schema-loader status

The loader is [LoadTestSchema.php](../backend/app/Console/Commands/LoadTestSchema.php)
and is invoked from `backend/` as:

```powershell
php artisan salo:test-schema-load --dry-run
```

It reads the root SQL and selects exactly 50 `CREATE TABLE` statements and
the two seed `INSERT`s for `platform_settings` and `shifts`. It skips
`DROP DATABASE`, `CREATE DATABASE`, `USE`, and `SET` statements, and refuses
unexpected SQL. Before it connects, it requires `APP_ENV=testing`, MySQL or
MariaDB, and `DB_DATABASE` and Laravel's configured database both equal to
`salo_test`. It then checks `SELECT DATABASE()` is also `salo_test` and that
the database has no tables. Applying requires `--apply` and interactive
confirmation. `phpunit.xml` and tests remain unchanged.

Dry-run result: the read-only preflight confirmed `DB_DATABASE =
SELECT DATABASE() = salo_test` and found zero tables. It printed the 52
allowlisted statement names, skipped the destructive database/setup
statements, and exited successfully. **No table DDL or seed INSERT was
executed.** The owner-reported settings added to live `salo` were not queried
or modified.

Exact statement list printed:

```text
01. CREATE TABLE users
02. CREATE TABLE platform_admins
03. CREATE TABLE auth_tokens
04. CREATE TABLE psgc_locations
05. CREATE TABLE platform_settings
06. CREATE TABLE cuisine_types
07. CREATE TABLE restaurants
08. CREATE TABLE audit_logs
09. CREATE TABLE notifications
10. CREATE TABLE restaurant_applications
11. CREATE TABLE application_documents
12. CREATE TABLE restaurant_photos
13. CREATE TABLE restaurant_staff
14. CREATE TABLE invitations
15. CREATE TABLE restaurant_cuisines
16. CREATE TABLE operating_hours
17. CREATE TABLE closure_dates
18. CREATE TABLE reservation_settings
19. CREATE TABLE menu_categories
20. CREATE TABLE menu_items
21. CREATE TABLE dietary_tags
22. CREATE TABLE menu_item_dietary_tags
23. CREATE TABLE user_addresses
24. CREATE TABLE carts
25. CREATE TABLE cart_items
26. CREATE TABLE checkout_groups
27. CREATE TABLE orders
28. CREATE TABLE order_items
29. CREATE TABLE order_status_histories
30. CREATE TABLE payments
31. CREATE TABLE discounts
32. CREATE TABLE discount_redemptions
33. CREATE TABLE restaurant_tables
34. CREATE TABLE reservations
35. CREATE TABLE restaurant_reviews
36. CREATE TABLE favorite_restaurants
37. CREATE TABLE favorite_menu_items
38. CREATE TABLE support_tickets
39. CREATE TABLE ticket_messages
40. CREATE TABLE zones
41. CREATE TABLE shifts
42. CREATE TABLE zone_shift_capacities
43. CREATE TABLE rider_profiles
44. CREATE TABLE rider_documents
45. CREATE TABLE rider_preferred_shifts
46. CREATE TABLE rider_shift_assignments
47. CREATE TABLE deliveries
48. CREATE TABLE delivery_offers
49. CREATE TABLE rider_reviews
50. CREATE TABLE co_owner_requests
51. INSERT INTO platform_settings
52. INSERT INTO shifts
Skipped: DROP DATABASE, CREATE DATABASE, USE, and SET statements.
Preflight passed: DB_DATABASE and SELECT DATABASE() are salo_test; the database is empty.
Dry run complete. No SQL statements were executed.
```

The only warning was that the local PHP CLI loads the OpenSSL module twice;
the dry run still exited successfully.

## 11. D0/F2 exit checklist

- [x] Read the driver prompt, supplied addendum text, Plan v2, and root SQL.
- [x] Audit auth/OTP/modes, permissions, Admin rider queue, zones/shifts,
  orders/tracking, notifications, email support, local storage, and test
  configuration from source.
- [x] Record rider schema fit; recurring shifts use the existing schema.
- [x] Document rider flows, endpoint contract, cache keys, scheduler jobs,
  private file design/setup, sample command plan, and responsive layouts.
- [x] Implement the guarded `salo_test` schema loader.
- [x] Run only its dry run; no DDL, seed INSERT, migration, or test was run.
- [x] Stop for owner review before D1; D0 was approved before implementation.

## 12. D1 verification and hand-test checklist

### Automated validation

- Full guarded PHPUnit suite: **144 tests, 956 assertions, all passed**, in
  34.626 seconds. No failures, errors, or skipped tests.
- PHP syntax checks passed for all changed PHP files.
- `npm run lint` passed.
- `npm run build` passed.
- The CLI emitted a pre-existing duplicate OpenSSL-module warning. Tests were
  run with GD enabled in the same PHP process. No migration, loader, schema
  edit, or live-`salo` database write was performed.

### Responsive verification limits

The viewport checks used the integrated browser's viewport emulation against
the local Vite app, with no authenticated user. Exact viewports checked:
360x640, 390x844, 412x915, 768x1024 portrait, 1024x768 landscape, 1280x800,
and 1920x1080. The signed-out application route had no horizontal overflow.
The authenticated wizard and Admin review UI were not visually verified;
neither was a real phone, camera, GPS, permissions-denied, offline, or
orientation-change interaction. The viewport checks do not replace D7's
real-device verification.

### Suggested manual checks

Use a local frontend/API configuration connected only to `salo_test` and a
disposable test account. Do not point the app at live `salo`; no sample user
or sample rows were created by D1.

1. Sign in as a Customer and open `/rider/apply`. Complete the wizard with a
   valid barangay-level PSGC code and street; try motorcycle and non-motorcycle
   document paths, save/resume a text draft, and confirm submitted data is
   locked pending review.
2. On a phone, test camera capture and file-picker fallback. Check image
   orientation, resize/compression, preview, progress, replace/retake, the
   2 MB limit, invalid/fake file errors, and that no image appears in browser
   `localStorage`.
3. As Admin, review the application, inspect private document previews, and
   approve, request revision, and reject with a reason. Verify a non-owner
   cannot read another rider's application, profile, or documents.
4. As the rider, request/resend the activation OTP, try a wrong and an expired
   code, then verify the valid single-use code. Confirm Driver capability is
   absent before verification and enabled only afterward.
5. Confirm files are under `storage/app/private`, document links expire after
   five minutes, and access is denied after ownership/authorization changes.
6. Repeat the authenticated wizard and Admin checks at the listed viewport
   sizes and on a real phone over HTTPS or localhost; test safe areas,
   camera/GPS permission denial, offline recovery, reduced motion, and
   orientation changes.

### D2 manual checks

Use an Admin account and rider test accounts against `salo_test` only.

1. Create a zone and verify its per-shift capacity, then deactivate and
   reactivate it. Confirm existing assignments are waitlisted on deactivation
   and reconsidered on activation.
2. Approve a rider with a preferred shift and home coordinates. Verify the
   nearest eligible zone is assigned, distance ties use zone ID, and a full
   or too-distant set of zones produces a reasoned waitlist entry.
3. Increase capacity and run `php artisan salo:recheck-rider-waitlist`;
   confirm the oldest eligible waitlisted rider is assigned. Lower capacity
   and confirm existing assignments are not removed.
4. Override an assignment with a reason and confirm the audit entry. Suspend
   a rider and confirm its assigned capacity is released and waitlisted riders
   are reconsidered. Confirm an OTP-pending rider cannot be promoted to active
   by the Admin scheduling control.
5. Check the Admin scheduling page at 360x640, 390x844, 412x915, 768x1024
   portrait and 1024x768 landscape, plus 1280px and 1920px widths. These D2
   authenticated viewport checks were not run during implementation.

### D3 manual checks

1. Sign in as an approved, OTP-activated rider, switch to Driver mode, and
   verify the assignment and current shift. Try Online with location denied,
   then allow location and go Online; confirm a single snapshot is cached.
2. Move a COD delivery order to `ready`. Confirm the nearest eligible rider
   receives exactly one offer with no customer name, phone, street address, or
   delivery note. Decline or let it expire and verify the next untried rider
   gets the offer before dispatch widens to another zone.
3. Accept the offer and verify only that rider sees pickup details, customer
   name/phone, exact delivery address, note, and order items. End the delivery
   in the authorized later-phase workflow and confirm the rider can no longer
   retrieve those details.
4. With no untried eligible rider, confirm the delivery stays `offered` with
   no assigned rider and the customer, restaurant, and Admin each receive one
   notice. Bring a rider Online or add an eligible assignment and verify the
   scheduled retry can offer it.
5. Switch away from Driver mode, go Offline, suspend the rider, expire the
   location, cancel a ready order, and cross the shift boundary; confirm
   ineligible riders receive no new offers and pre-pickup offers are released.
   Confirm an accepted delivery remains assigned after `picked_up`.
6. Check the Rider page at 360x640 and 768x1024 landscape, which were not
   covered in the implementation browser check. Then repeat GPS permission,
   offline recovery, reduced-motion, reduced-transparency, safe-area, and offer
   countdown checks on a real phone.

**D4 is implemented within the approved OSM/no-router boundary. In-app road
routing, live browser/device verification, and the listed D4 viewport checks
remain pending; do not start D5 without approval.**
