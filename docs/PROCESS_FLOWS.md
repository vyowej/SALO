# SALO Process Flows

**Status:** Phase A proposal. These flows describe intended behavior only. No Laravel code or database structure is created in this step.

## 1. Registration, login, and account state

1. First-party SPA obtains Sanctum's CSRF cookie from `/sanctum/csrf-cookie`.
2. `POST /api/v1/auth/register` validates the request, creates one account for the person, grants the customer capability automatically, and establishes the stateful session. Do not accept client-supplied capabilities or memberships.
3. Login verifies credentials and rejects inactive/deactivated/suspended accounts. Apply login rate limiting before credential checking and return one generic credential/state failure to avoid account-state disclosure.
4. Logout invalidates the session and rotates/invalidate CSRF state according to Laravel/Sanctum behavior.
5. Password reset requests always produce a generic confirmation. A reset token is single-use, time-limited, and never returned in API JSON.
6. `/auth/me` returns user status, platform capabilities, restaurant memberships and effective permissions, and driver state so client navigation is permission-derived. `DELETE /customer/profile` soft-deactivates the one account and invalidates sessions. Preserve historical transactions. If the account owns restaurants, stop accepting new orders and reservations immediately; do not remove history.

## 2. Become an owner

1. An authenticated customer submits restaurant details at `POST /api/v1/applications/restaurants`.
2. Validate required identity/contact/location data, required `delivery` and `walk_in` service support, and either a 24/7 declaration or a valid weekly-hours schedule.
3. Create a pending application and pending restaurant. Pending restaurants are not discoverable, orderable, or reservable; they are accessible only to the applicant and admin.
4. Admin reviews the application. Rejection requires a recorded note and grants no membership or capability. Approval changes the restaurant to approved and creates an owner membership for the same account; it does not add a platform-level owner capability.
5. Restaurant APIs always scope restaurant/menu/order/reservation/table/discount access to the restaurant membership and required permission using policies. Guessing another restaurant's identifier never grants access.
6. Admin suspension removes the restaurant from customer discovery and blocks new orders/reservations while retaining historical records. Owner deactivation has the same new-transaction block.

## 3. Become a driver

1. An authenticated customer submits `POST /api/v1/applications/rider`. The form includes personal/contact, residence, availability, and vehicle/application details required by the accepted brief. Sensitive documents use the upload flow and must be private. Exact required identity documents are [VERIFY].
2. Application remains pending and does not grant driver routes.
3. Admin approves or rejects with an auditable decision. Approval adds the `driver` platform capability; rejection leaves the account's existing capabilities unchanged.
4. The approved driver opts online and may claim eligible unassigned jobs from the job board. Claim must atomically assign first-claim-wins; a driver cannot claim while offline, suspended, or otherwise ineligible.
5. Private fulfillment details are revealed only after assignment. Assigned-driver routes return only jobs assigned to that account, and every milestone update is transition-checked and audited.

## 4. Restaurant availability and catalog

1. Guest restaurant discovery calls only `/public/restaurants/popular`. Every other restaurant listing, search, details, menu, and availability request requires authentication.
2. Only approved restaurants are included in customer-facing results. Apply restaurant status and owning-account active state on each read and transaction, not only in the user interface.
3. Each restaurant supports `delivery` and `walk_in`. `is_24_7` means open-now checks skip weekly hours. Otherwise, evaluate the restaurant's configured weekly hours against current `Asia/Manila` time, including schedules crossing midnight.
4. Keep `is_active` separate from `availability`. An inactive or sold-out item cannot be ordered even if one of those other values would imply availability.
5. Prices must be greater than zero. All price changes, options, availability, category state, restaurant state, service mode and operating hours are revalidated on checkout.

## 5. Multi-restaurant checkout and idempotency

1. Client submits one checkout-group request with one order payload for each selected restaurant and an `Idempotency-Key`.
2. Normalize the request, bind the key to the authenticated customer, and look up a prior result. Same key + same normalized payload replays the prior response. Same key + different payload returns `IDEMPOTENCY_KEY_REUSED`.
3. Before any writes, validate **every** restaurant order: approved/active status, owner active state, service mode, open-now or accepted schedule, address/delivery eligibility, recipient details, every current menu item/category/options, quantities, stock/availability rules, discount, and all fees.
4. If any one restaurant fails validation, return `CART_VALIDATION_FAILED` with errors grouped by restaurant; create no group, order, discount usage, or partial item changes.
5. If all pass, execute creation of the checkout group, every member order and immutable line snapshots, discount usage, and idempotency result within one transaction boundary. A database/integration failure rolls back the full group.
6. Compute each order subtotal, discount, service/delivery charges and final total on the server. Derive the group grand total from member order totals at response time; never store the group total as an independent amount.
7. Walk-in/pickup map to canonical `walk_in` at the API boundary; a frontend adapter may translate labels, but the backend enum and policy remain `walk_in`.

## 6. Order fulfillment and cancellation

Allowed forward lifecycle:

```text
pending → confirmed → preparing → ready → completed
                                    └→ out_for_delivery → completed (delivery only)
```

- A restaurant member with the relevant permission confirms a pending order, moves it through preparing and ready, and completes walk-in orders.
- Assigned driver moves a delivery order from ready to out-for-delivery and then completed. Assignment and transitions are guarded against unassigned drivers and stale states.
- Customer may cancel only their own pending order.
- Authorized restaurant member or admin may cancel a later non-terminal order only with a non-empty reason; record actor, reason, and timestamp.
- Completed and cancelled are terminal. Reject invalid or repeated transitions with `INVALID_STATUS_TRANSITION`; do not silently advance or accept arbitrary status changes.
- On owning-account deactivation or restaurant suspension, reject new checkout, but allow authorized fulfillment/history operations on already-created records.

## 7. Discounts and server totals

1. Resolve the discount and verify active flag, date window, scope, funding source, minimum eligible subtotal, and remaining usage limit.
2. Calculate percentage or fixed discount, apply the optional maximum cap, and prevent discount from exceeding the eligible subtotal.
3. Calculate final amount from validated current prices and server fee configuration. The client quote is advisory; checkout performs the same validations again.
4. Claim usage within the successful checkout transaction so concurrent final-use requests cannot exceed the limit. On group validation failure, consume no usage.
5. Attribute discount funding to platform or restaurant in accounting/resource output. Do not accept funding source or calculated discount amounts from customers.

## 8. Reservations and table locking

1. Customer requests availability for an approved restaurant, future local date/time, guest count and optional service mode. Return only eligible tables/slots.
2. Creating a reservation validates restaurant approval/active state, its accepting state, open hours or `is_24_7`, future time, guest count against capacity, and maintenance status.
3. Within a transaction, lock the selected table row first, then query for overlapping active reservations, then create the pending reservation. Use the same lock order across all reservation writers to avoid race conditions/deadlocks.
4. When a table is not specified by a client, select an eligible table server-side and perform the same locked overlap validation; never trust client-supplied availability.
5. A restaurant member with reservation-management permission confirms/completes/cancels/marks no-show under policy. Customer can cancel only their own pending or confirmed reservation at least two hours before its local start.
6. Reservation statuses are `pending`, `confirmed`, `completed`, `cancelled`, `no_show`. Transitions outside the approved lifecycle return `INVALID_STATUS_TRANSITION`.

## 9. Location lookups

1. Saved addresses, checkout delivery addresses, restaurant locations, and rider home locations use the order Country, Province, City/Municipality, Barangay, Street, House number. Country is displayed as Philippines, locked while it is the only supported country, and must be stored. Proposed requiredness and exact persisted fields require owner confirmation before C1.
2. PSGC type-ahead uses the official hierarchy: `/regions/`, `/regions/{regionCode}/provinces/`, `/provinces/{provinceCode}/cities-municipalities/`, and `/cities-municipalities/{cityCode}/barangays/`. Each selection clears and reloads lower fields. The backend verifies code existence, expected level, and each parent-child relationship; a barangay must belong to the chosen city/municipality. City-first search returns qualified hierarchy and fills its parent context when selected.
3. PSGC v3 levels are region, province, city, and barangay; municipalities are represented at level `city`. Ordinary city/municipality rows belong to a province. NCR cities/municipalities are directly under the NCR region and have no province row; show `Metro Manila (NCR)` in the skipped province position. Independent cities such as Zamboanga City are directly under their region; show `None (independent city)` and skip province selection. These display values are not PSGC province records.
4. `Use my current location` obtains browser coordinates, then calls the backend reverse-geocoding provider to fill editable address fields. Dragging the pin repeats reverse geocoding and refreshes the fields. Show and persist the final one-line formatted address. Street autocomplete, when approved/configured, is also called through the backend and restricted to the Philippines. Manual street entry remains available.
5. Cache hierarchy lists and normalized lookups; apply upstream timeouts. On provider failure, return a friendly `LOCATION_PROVIDER_UNAVAILABLE` response and allow manual street entry and pin selection; do not emit fake success data. Evaluate Geoapify first for PH-limited street/landmark autocomplete, with Photon and LocationIQ as alternatives. Verify each provider's free-tier limits, terms/attribution, and privacy impact [VERIFY]. Nominatim is for a single reverse-geocoding lookup only; use a custom User-Agent, at most one request per second per application, caching, and timeout. It cannot provide autocomplete.
6. All provider calls are backend-only behind one `locationService` interface; keys are in backend `.env`, never hard-coded or exposed. Addresses and coordinates may be sent to a third party: send the minimum needed, never user IDs, and disclose the transfer. Province/city/barangay values come only from local PSGC; reverse-geocoded administrative values must be resolved against it.
7. Coordinates use the agreed coarse Philippine bounds in one config value with a clear error and a test. Exact Philippine boundary checking remains deferred [VERIFY]. Re-check provider terms before implementation/release. See [PSGC API](https://psgc.gitlab.io/api/), [Nominatim Reverse](https://nominatim.org/release-docs/latest/api/Reverse/), and [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).

## 10. Schedulers

- Periodically expire reservation holds and cart records using configurable cutoffs. The specific hold duration and cart TTL are not set in the brief and must be confirmed/configured before launch.
- Reset daily menu quantities using each restaurant's local calendar date/timezone and an auditable scheduled command.
- Scheduled work must be retry-safe, bounded, and logged; it must not delete completed orders, reservations, applications, or account history.

## 11. Membership and team invitations

1. Restaurant owner invites an email with one allowed restaurant role. An invitation is not an account and does not grant access before acceptance.
2. The system issues a high-entropy single-use token, stores only its hash, applies an expiry, and sends the invite link without disclosing whether an account already exists.
3. Invitee signs in or registers with the invited email and accepts. Re-check token expiry, use, email match, restaurant status, and invitation revocation at acceptance.
4. Create only the scoped restaurant membership; do not alter platform capabilities. Return effective permissions to `/auth/me`.
5. Revoke/suspend/remove membership immediately affects subsequent authorization checks. Owner-only role changes must not permit removing the last owner or self-elevating; owner transfer details are [VERIFY].

## 12. Delivery job lifecycle and private tracking

1. Eligible delivery order becomes claimable only after restaurant preparation marks it ready and delivery work is available. The job board shows only a public-safe summary with no recipient identity, phone, exact address, or rider notes.
2. An approved active driver who is online submits a claim. A transaction checks job unclaimed status and driver eligibility, then assigns once; a concurrent losing claim receives conflict and reloads the board.
3. Only after claim does the assigned driver receive the delivery address/contact data necessary to fulfill that job. Restaurant users see the same data only when authorized for that restaurant and operationally necessary.
4. Driver reports ordered milestones. The backend checks assignment and expected prior state; stale, repeated, or invalid transitions are rejected and audited.
5. For an active assigned delivery, the driver submits current coordinates. Store only a short-lived cache value containing the latest point/time; do not persist a trail or expose location to unrelated users.
6. Customer and authorized restaurant view tracking through polling while delivery is active. The response includes last known point only when fresh, and an ETA only when a configured routing provider returns a valid result. Stale/missing provider data is explicit and does not fabricate a location/ETA.
7. Clear cached driver location at delivery completion/cancellation and stop accepting pings for terminal jobs.

## 13. Sensitive profile edits and uploads

1. Require current-account authentication and field validation for profile changes. Changes to sensitive identity/contact fields can trigger a verification/reapproval state; exact fields and reapproval consequences are [VERIFY].
2. Uploads are purpose-bound to an application or business resource. Validate content, size, signature and authorization; keep private files private and return only short-lived access URLs to authorized reviewers.
3. Replacing a document invalidates or supersedes the old attachment according to retention policy. Record review decisions and access events without logging document contents or credentials.

## Assumptions requiring review

1. The authenticated customer capability is the applicant capability for restaurant and rider applications. This matches the single-account capability model; guest onboarding is not part of this proposal.
2. `walk_in` is the canonical backend service mode. The current UI sometimes labels this “Pick-up”; any mapping belongs in the later frontend adapter.
3. The brief does not define payment-provider endpoints, fees, service-fee formula, delivery quote formula, tax, or currency rounding policy. They are intentionally not invented as API/payment integration; server totals require those values from approved configuration/business policy.
4. Reservation duration, table assignment preference, slot increment, cancellation boundary behavior at exactly two hours, and hold expiration duration need explicit configuration/approval.
5. Cart TTL, quantity decrement/reset policy, scheduled checkout window, and whether inventory is reserved during cart hold need confirmation.
6. Driver eligibility limits (including maximum concurrent jobs), delivery proof requirements/storage, and location ping interval/cache TTL require confirmation.
7. Application fields, legal/identity document requirements, sensitive-field reapproval policy, email verification gates, admin reason/audit retention, pagination bounds, and exact rate limits require product/security configuration before implementation.
8. Leaflet/OSM tile policy, public tile usage capacity, OpenRouteService key/plan limits, attribution display, service availability, and fallback provider need verification before selection. Nominatim public service does not allow autocomplete and is limited to one request per second per application; a debounced keystroke-search requirement conflicts with that policy.
9. The Data Privacy Act impact assessment and applicable retention, consent, data-subject request, and breach-response duties need qualified legal/privacy review before launch. This document is not legal advice.
10. “Every response has an API Resource” applies to success resource representations. Framework error envelopes remain normalized exception responses; no raw exception/provider data is exposed.
