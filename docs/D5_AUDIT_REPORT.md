# D5 Audit Report — Delivery Lifecycle, Proof of Delivery, and COD

**Scope:** Read-only implementation audit and planning. No application code,
schema, migrations, data, or test fixtures were changed. The only new file is
this report.

## 1. Current implementation and architecture

D3 dispatch and D4 location tracking are database-backed. `RiderDispatchService`
owns offer assignment and responses, `RiderDispatchController` exposes the
authenticated Driver routes, and `CustomerOrderService` scopes order and
tracking reads to the customer. Delivery files are configured for Laravel's
private local disk. The authoritative design is `database/salo_db.sql`; the
existing Laravel migration set does not fully represent that schema (see
Section 9).

### Relevant code paths

- Rider offer/current-delivery routes:
  `backend/routes/api.php` (`/driver/current-delivery`,
  `/driver/delivery-offers/{offer}/accept|decline`,
  `/driver/deliveries/{delivery}/location`).
- Offer acceptance, assignment, cancellation, and dispatch:
  `backend/app/Services/RiderDispatchService.php`
  (`respondToOffer`, `cancelForOrder`, `forceOfflineForProfile`).
- Rider route authorization:
  `backend/app/Http/Controllers/Api/V1/Rider/RiderDispatchController.php`
  and `backend/app/Policies/RiderProfilePolicy.php::accessDispatch`.
- Business order transitions:
  `backend/app/Services/BusinessOrderService.php::transition` and
  `backend/app/Http/Requests/Business/OrderStatusRequest.php`.
- Customer tracking, cancellation, and receipt confirmation:
  `backend/app/Services/CustomerOrderService.php` and
  `backend/app/Http/Controllers/Api/V1/Customer/CustomerOrderController.php`.
- Private proof metadata and Admin download:
  `backend/app/Services/RiderAdminService.php::proofs`,
  `createProofDownloadUrl`, and `streamProof`;
  `backend/app/Http/Controllers/Api/V1/Admin/AdminController.php`.
- Private disk and existing image validation pattern:
  `backend/config/filesystems.php` and
  `backend/app/Services/PrivateRiderDocumentStorageService.php`.
- Rider UI and current customer receipt UI:
  `src/pages/Rider/RiderPage.jsx` and
  `src/pages/OrderDetail/OrderDetailPage.jsx`.

## 2. Delivery lifecycle audit

The delivery state set in the SQL is exactly `offered`, `accepted`,
`picked_up`, `delivered`, `failed`, and `cancelled`. Order states separately
include `ready`, `out_for_delivery`, `delivered`, `completed`,
`delivery_failed`, and `cancelled`. No `at_restaurant` or `arrived` state is
defined or used by the current rider implementation.

| Transition / operation | Current behavior | Audit result |
|---|---|---|
| Create / assign | A ready delivery order can get a `deliveries` row in `offered`; one rider and `delivery_offers` row are assigned transactionally. | Implemented in D3. |
| `offered` → `accepted` | `respondToOffer` locks order, delivery, offer, and rider; verifies pending offer, rider assignment, order still `ready`, expiry, and rider eligibility. Writes offer response, `accepted_at`, and `busy` availability. | Implemented; repeat acceptance returns unavailable rather than applying a second transition. Order status remains `ready`. |
| Decline / timeout | Offer response is recorded; rider is detached and dispatch retries. The delivery remains `offered`. | Implemented in D3. |
| `accepted` → `picked_up` | No rider action, route, or service transition exists. | Missing. |
| `picked_up` → `delivered` | No rider action, route, proof upload, or service transition exists. | Missing. |
| `accepted`/`picked_up` → `failed` | No rider action, reason validation, order update, or Admin review workflow exists. | Missing. |
| Cancel | Business order cancellation invokes `cancelForOrder`, which marks the delivery cancelled, clears its rider, and times out pending offers. Customer cancellation currently accepts only a `placed` order. | Partial; no rider cancellation endpoint or picked-up recovery rule exists. |
| Customer receipt | On an order in `delivered`, the customer may confirm once; this changes the order to `completed`. | Backend action exists; dispute and automatic-confirm flows do not. |

`BusinessOrderService` permits `placed → confirmed|rejected`,
`confirmed → preparing|cancelled`, `preparing → ready|cancelled`, and
`ready → completed|cancelled`, with restaurant completion restricted to
pick-up orders. It rejects duplicate/invalid transitions and requires a reason
for restaurant rejection/cancellation. The customer may cancel only while
`placed`; customer confirmation is guarded against repeat confirmation.

Delivery acceptance is protected against stale/duplicate offer responses by
transaction locks and current-state checks. Business order transition tests
cover invalid and duplicate status changes. However, there is no centralized
delivery-transition guard: `Delivery` model events clear location on terminal
status but do not validate the prior state. Service-level D5 transitions will
need locks and explicit allowed-from checks to prevent duplicate pickup,
completion, failure, and cancellation requests from racing.

Order/delivery synchronization is incomplete because the D5 actions are
absent. Acceptance intentionally leaves the order at `ready`; the planned
pickup action must move it to `out_for_delivery`, delivery completion to
`delivered`, and failure needs an approved order-state mapping (the schema has
`delivery_failed`). Current business cancellation can cancel an offered or
accepted delivery. No customer-facing failure notification or Admin review
event is generated by a rider failure path because none exists.

## 3. Authorization and visibility

- Driver routes are behind `auth:sanctum` and `capability:driver`; the
  controller also checks the authenticated user's own profile through
  `accessDispatch`, which requires an active user, approved application, and
  active rider profile. Location updates additionally require that the rider
  is assigned to the specified active delivery.
- `currentFor` selects deliveries by the authenticated rider profile. Customer
  name, phone, exact address, and items are only returned after acceptance;
  offers contain an approximate area instead.
- Customer order detail/tracking first resolves the order through the
  customer's ownership query and applies `CustomerOrderPolicy`. The D4
  tracking response does not return rider identity or contact information.
- Business order routes use restaurant membership permissions and scope the
  order to that restaurant. `OrderResource` exposes payment/status snapshots
  but there is no business POD authorization/download endpoint.
- Admin proof list and download routes require an active Platform Admin via
  `RiderProfilePolicy::review`. General Admin order resources still use the
  `InMemoryAdminRepository`; they are not a database-backed delivery-progress
  or cash-remittance surface. D5 Admin work must not assume that fixture-backed
  resource as a real record store.

## 4. Proof of Delivery assessment

### Present

- `deliveries` has one `proof_photo_path`, `proof_lat`, `proof_lng`, and
  `delivered_at`; the one-delivery-per-order key makes the delivery the
  association point.
- `private` uses Laravel's local driver rooted at
  `backend/storage/app/private`, not a public URL. `Delivery` is fillable for
  proof metadata.
- Admin can list delivered proof metadata and request a five-minute signed
  URL. Streaming checks Admin authorization, validates that the path is
  under the expected rider proof directory, checks the file exists and has
  an allowed image MIME, and sends private/no-store headers.
- `RiderAdminDirectoryTest` covers database-backed Admin metadata/streaming
  and denial of a customer attempting to access Admin/private media.

### Missing / mismatched

- There is no rider camera UI, capture-input fallback, preview/retake flow,
  upload endpoint, proof FormRequest, image re-encoding for proof, or
  transactional completion flow. Existing rider document validation is a
  useful pattern (2 MB cap, `finfo`, image decoding/re-encoding), but it does
  not implement proof upload or delivery association.
- The existing Admin proof path validator expects
  `riders/{rider_id}/proofs/{random}.{ext}`. The approved private-file layout
  for proof is `deliveries/{delivery_id}/proof-{random}.{ext}`. No writer
  exists yet; align the reader and future writer with the approved delivery
  layout before files are created.
- Current proof visibility is Admin-only. There is no authorized proof route
  for the owning order's customer or restaurant staff with order permission.
  The signed stream endpoint is not a public link: it is authenticated and
  repeats the Admin policy check.
- There is no replacement/duplicate upload behavior, proof cleanup job, or
  orphan proof cleanup. `delivery_proof_retention_days=30` exists in the SQL,
  but code uses only `rejected_doc_retention_days` in the rider-document
  pruning command. The D5 retention setting is not consumed.
- The current streaming method does not itself require that a delivery is
  still `delivered`; it requires a proof path and Admin access. Expiry and
  retention deletion are not implemented.

The SQL fields are sufficient for the currently specified single proof:
path, server delivery timestamp, and coordinates. `delivered_at` can serve as
the server-side proof/completion timestamp; a separate capture-time column is
not evidently required.

## 5. COD workflow assessment

- Checkout derives `orders.total_amount` from subtotal + delivery fee + service
  fee − discount, floored at zero. The payment row is created with the chosen
  method, `status=unpaid`, and `amount=total_amount`. The configured delivery
  checkout uses COD.
- Dispatch checks that a COD payment row exists; it does not record cash
  collection or change payment status.
- `deliveries.cash_collected` and `cash_remitted` exist in the SQL and model,
  but no service, request, rider UI, Admin remittance route, or payment
  synchronization uses them.
- No application code prevents duplicate cash collection or ensures the
  collected amount equals the server-side order total.
- `CustomerOrderService::confirmReceipt` confirms receipt, not cash collection.
  It does not update `payments.status` or `paid_at`; delivered must not be
  treated as proof that COD was collected.
- The generic Admin order list/cancel service is fixture-backed. There is no
  database-backed Admin remittance workflow.

The existing schema can store one full cash collection and a remitted flag.
The generic `audit_logs` table can record the Admin actor, event, and time for
remittance; its configured retention is 90 days, so long-term financial audit
requirements should be confirmed.

## 6. Customer receipt and failed-delivery follow-up

The customer UI offers only “Yes, I received it” after status `Delivered`.
The backend transitions that order to `completed` and records customer
confirmation. There is no “No” action. The existing support-ticket table and
API accept an optional `order_id`, so a linked ticket is structurally
possible, but no receipt-dispute flow creates one automatically.

`receipt_autoconfirm_hours=24` exists in the authoritative SQL. No command,
scheduled job, or service reads it to auto-confirm delivered orders. Therefore
the described “No creates a support ticket; no answer auto-confirms” flow is
not complete.

## 7. Database and migration gap assessment

The authoritative SQL already has the required D5 storage fields:

- `deliveries.status`, `accepted_at`, `picked_up_at`, `delivered_at`;
- `proof_photo_path`, `proof_lat`, `proof_lng`;
- `cash_collected`, `cash_remitted`;
- `orders.status`, `completed_at`, and order snapshots/totals;
- `order_status_histories` with actor, from/to status, reason, and timestamp;
- `payments` with method, status, amount, and `paid_at`;
- generic `audit_logs`; and platform settings for proof retention and receipt
  auto-confirm.

**No new schema change is currently necessary for the stated D5 flow, so no
numbered schema proposal is being made and `docs/SCHEMA_GAP_REPORT.md` was not
changed.** The current schema does not record partial cash remittances or a
dedicated remittance timestamp/actor, but the specified one-time remittance
flag plus an Admin audit event can satisfy the current plan. Revisit schema
only if you require partial remittance or audit evidence that must outlive
generic audit-log retention.

The checked migration set is not a faithful recreation of the authoritative
SQL. For example, migration
`backend/database/migrations/2026_10_30_000007_create_shared_order_tables.php`
uses `orders.checkout_group_id` and `order_status_histories.actor_user_id`,
while the SQL uses `orders.checkout_id` and `order_status_histories.changed_by`.
It also makes `payments.order_id` unique while the SQL does not. No checked
migration creates the `deliveries` table or D5 columns. These migrations must
not be run as a D5 setup path; implementation and tests must continue to use
the approved guarded schema.

## 8. Existing test coverage

- `RiderDispatchTest` covers offer acceptance/privacy, order cancellation
  cleanup, rider ownership, and D4 cache lifecycle. It does not exercise D5
  pickup, proof upload/completion, failure, or COD collection.
- `BusinessOrderManagementTest` covers restaurant order state transitions,
  cancellation, invalid delivery completion by a restaurant, and duplicate
  cancellation. It does not cover rider delivery-state synchronization.
- `RiderAdminDirectoryTest` covers Admin-only database-backed proof metadata
  and private streaming, but the proof row/file are fixture-created; it does
  not test proof upload validation, customer/restaurant proof access,
  retention, or an expired signed URL.
- `OrderDetailPage.test.jsx` covers D4 tracking and currently does not exercise
  “No” receipt handling, auto-confirm, or proof display.
- No tests were run for this read-only audit.

## 9. Proposed implementation sequence (for approval)

1. Agree on lifecycle/failure/cancellation and COD/receipt decisions below.
2. Add explicit transaction-backed Rider service transitions with row locks,
   from-state checks, assigned-rider checks, order/delivery synchronization,
   order history, notifications, and idempotent/duplicate-request tests.
3. Implement proof capture/upload to the private local disk: client preview,
   compression and camera fallback; server content validation/re-encoding,
   server-generated path, safe replacement/orphan handling, and completion
   transaction. Align proof readers with the approved delivery-based path.
4. Add scoped proof access for Admin, the order's customer, and authorized
   restaurant staff; use short-lived authorized links or policy-checked
   streaming. Add proof-retention and orphan cleanup using the existing
   setting.
5. Add COD amount validation and locked one-time collection; synchronize
   payment only according to the approved collection rule. Add a database-backed,
   Admin-authorized, audited remittance action.
6. Complete the customer receipt “No”/support and configured auto-confirm
   behavior if approved; keep receipt confirmation distinct from payment.
7. Add backend feature tests on guarded `salo_test`, frontend tests, then
   manual camera/GPS/private-file/Admin/customer/restaurant checks. Do not run
   migrations or seeders.

## 10. Business-rule decisions required

1. **COD gate and payment state:** Should exact full cash collection be required
   before the rider can mark a COD delivery `delivered`? Recommendation: yes;
   atomically record `cash_collected` and set the COD payment to `paid` with
   `paid_at` when physical cash is received, while keeping remittance separate.
   Confirm whether any partial payment, change/tip, or collection exception is
   allowed.
2. **Cash remittance:** Is remittance a one-time full settlement (fits the
   existing boolean), or are partial remittances required? Recommendation:
   one-time full settlement and one Admin audit event. Confirm whether the
   90-day generic audit retention is sufficient for remittance evidence.
3. **Failure rules:** Confirm the allowed failure-reason list and whether a
   failure is final (`orders.status=delivery_failed`) or can be retried/reassigned.
   Recommendation: use the existing `delivery_failed` order status and retain
   the reason in order history; require an explicit Admin/customer-support
   decision before a new delivery attempt.
4. **Cancellation window:** Confirm who can cancel after a rider accepts and
   whether cancellation remains allowed after pickup. Recommendation: allow
   customer/restaurant/Admin cancellation only before pickup with a reason;
   after pickup, use the failure/dispute process rather than silently
   cancelling the order.
5. **Customer receipt dispute:** Confirm whether “No” creates an order-linked
   support ticket, and whether no response auto-confirms after the existing
   `receipt_autoconfirm_hours` setting (24 hours in the SQL). Recommendation:
   yes to both, with a scheduled auto-confirm that records
   `confirmation_method=auto`; ensure a customer “No” blocks auto-confirm
   until support resolves it.
6. **Proof unavailable:** Confirm how to handle denied/unavailable GPS or a
   camera/upload failure. Recommendation: block `delivered` until a valid
   private proof and coordinates are submitted; provide a visible retry and an
   Admin-reviewed exception only if you explicitly want one.
7. **Proof retention/replacement:** Confirm the existing 30-day
   `delivery_proof_retention_days` is the intended retention and whether
   deleting proof should also null the database path while retaining the
   order's delivered timestamp/coordinates. Recommendation: delete the private
   file after the configured period, clear its path, and retain non-image
   delivery/order history.
8. **Delivery event history:** Confirm that each order-state transition should
   be recorded in `order_status_histories` and delivery-only events (such as
   offer acceptance) remain represented by `deliveries` timestamps and
   `delivery_offers`. Recommendation: do not overload order statuses with
   delivery states; record consequential order transitions with actor/time
   and preserve the existing offer response records.

## 11. Recommended tests and manual verification

Backend feature tests:

- Legal/illegal delivery transitions, duplicate and concurrent pickup/delivered
  requests, cross-rider delivery IDs, inactive rider/mode, and transaction
  rollback.
- `picked_up` updates the order to `out_for_delivery`; delivered updates
  delivery and order consistently, records the actor/server time, and starts
  receipt handling; failed and cancellation mappings/reasons follow the
  approved rules.
- Proof accepts only a genuine allowed image within 2 MB, rejects fake MIME,
  extension mismatch and oversize inputs, re-encodes/strips metadata, stores
  only a server-generated private path, replaces/deletes safely, and does not
  complete an order on validation/storage failure.
- Proof access allows only the Admin, the order's customer, and restaurant
  staff whose policy grants order access; denies unrelated users; signed URLs
  expire; retention and orphan cleanup respect the configured setting.
- COD collection must match the locked authoritative order total, is
  idempotent under repeated/concurrent requests, changes payment state only
  according to the approved rule, never lets a rider mark cash remitted, and
  Admin remittance is authorized/audited.
- Failed/cancelled orders do not falsely mark COD paid; customer receipt
  confirmation is independent of payment; “No” and auto-confirm follow the
  approved workflow.

Frontend/manual checks:

- Verify rider pickup/delivered/failure controls at mobile and desktop widths,
  confirmation/error/loading/disabled states, keyboard access, and 48 px
  controls.
- On a phone using localhost or HTTPS, test camera capture and picker fallback,
  preview/retake, compression/upload progress, network failure/retry, and
  denied GPS behavior.
- Confirm proof bytes are not public and are absent from browser localStorage;
  test Admin, owning customer, authorized restaurant staff, and unrelated
  account access, including expired links and post-retention cleanup.
- Exercise COD exact amount, duplicate tap/retry, failed delivery, customer
  “Yes”/“No”, no-response timeout, and Admin remittance audit trail.

## 12. Worktree and safety record

At audit start, `git status --short` showed one pre-existing change:
`M src/components/location/MapView.jsx` (one-line diff). It was not opened for
editing, reverted, or included in this report change. There were no staged
changes. No application code, schema, migration, seeder, `.env`, or database
record was modified. No database connection, SQL, migration, or test command
was run.

## Blockers before implementation

- The eight decisions in Section 10 need confirmation, especially COD/payment
  synchronization, failed-delivery recovery, and cancellation after pickup.
- Proof-file path conventions must be reconciled with the approved
  delivery-based private layout.
- The existing migration drift makes migrations unsafe as a setup mechanism;
  D5 tests must use the guarded database created from the authoritative SQL.
- Real database-backed Admin remittance and non-Admin authorized proof access
  do not currently exist.
