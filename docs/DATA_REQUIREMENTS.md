# SALO Data Requirements

**Status:** Phase A requirements only. This is not a schema, migration, SQL specification, or approval of a database design.

The tables below describe information repository contracts must accept/return, validation invariants, and values that must be calculated rather than persisted as independent truth. Persistence details, keys, indexes, relations, and database engine remain for the user to design and approve. No repository may use raw queries outside its implementation boundary.

## Repository contract data

| Repository / boundary | Required data | Optional data | Derived, not stored as independent truth | Rules |
|---|---|---|---|---|
| `UserRepository` | Account ID, normalized email, password hash, account status, customer capability, creation/update timestamps | Name components, phone, avatar reference, verification timestamps, preferences | Display name, initials/avatar fallback, capability labels | One person/account; unique normalized email; never return password hash; registration cannot submit capabilities/status |
| `MembershipRepository` | User ID, restaurant ID, membership role/status, timestamps | Suspension/removal reason, inviter reference | Effective permission array from central `PermissionMap` | Membership scoped to one restaurant; only active membership authorizes; no account-wide owner role; preserve audit context on role/status change |
| `InvitationRepository` | Restaurant ID, invited normalized email, role, hashed token, expiry, state | Inviter ID, accepted user ID/time, revocation reason/time | Invitation URL/token is generated transiently; role permissions come from `PermissionMap` | Opaque single-use token; only hash persisted; matching signed-in email required; cannot grant owner/admin/driver; expire/revoke atomically |
| `RestaurantApplicationRepository` | Applicant ID, required business identity/contact/address details, application state and submission time | Supporting upload references, service modes, hours declaration, reviewer note/time | Completeness/eligibility result | Applicant owns submission; admin decisions audited; rejection/approval note rules; never expose private docs to public results |
| `RestaurantRepository` | Restaurant ID, applicant/owner relationship, name, address, approval/operational state, service modes | Description, cuisine, contacts/display assets, coordinates, operating hours, 24/7 flag | `is_open_now`, public visibility/orderability, owner display | Only approved and active restaurants public; suspension/deactivation blocks new transactions; owner relationship represented via membership |
| `MenuRepository` | Restaurant/category/item IDs, item name, price, active/availability state, timestamps | Description, options/extras, images, sort order, quantity limits | Category/item visibility and orderability | Positive money values; item active AND available AND active category; current state revalidated at checkout; restaurant membership permission checked |
| `AddressRepository` | User ID, address components, label, primary state | Coordinates, delivery note, structured PSGC codes | Formatted address string, selected address fallback | User-owned only; exactly one primary address per account where policy requires; never send private details to public geocoder; validate coordinate bounds |
| `CartRepository` | User ID, restaurant ID, item IDs, positive quantities, service mode, update/expiry timestamps | Option IDs, item note, address selection, selected discount code | Current prices, subtotal, fees, discount estimate, cart total | Partition by restaurant; server reprices/revalidates; do not treat local/client cart as authoritative; expiry policy [VERIFY] |
| `CheckoutRepository` | Idempotency key scoped to user, normalized request fingerprint, group/order references, result status | Expiry, safe error/response replay metadata | Group grand total from member order totals | Entire multi-restaurant checkout is all-or-nothing; exact replay returns original result; same key/different request conflicts; no persistent idempotency until DB design approval |
| `OrderRepository` | Order/group/restaurant/customer IDs, lifecycle state, immutable line snapshots, server totals, timestamps | Delivery/pickup details, cancellation reason/actor, discount reference, scheduled time | Current total components from authoritative order lines/config; status label | State machine only; customer can cancel own pending order; later cancellation requires reason; private fields only to necessary authorized participants |
| `ReservationRepository` | Customer/restaurant IDs, guest count, start/end time, status | Table ID (if allocated), guest note, reviewer/cancellation metadata | Availability and overlapping-reservation result | Future valid local time; table capacity/hours/maintenance checked; locking/transaction required to prevent overlap; two-hour cancel boundary [VERIFY] |
| `DiscountRepository` | Code, funding source, active state, discount type/value, scope | Min subtotal, cap, start/end, usage limit, restaurant reference | Eligibility, remaining uses, discount amount | Server validates/recalculates; discount cannot exceed eligible subtotal; usage consumption atomic and only on successful checkout |
| `DriverApplicationRepository` | Applicant ID, required identity/contact/residence/vehicle details, application state and submission time | Availability, supporting upload references, reviewer decision note/time | Approval eligibility; platform `driver` capability granted only on approval | Same person account; pending/rejected applications grant no driver routes; private evidence access restricted; exact required documents [VERIFY] |
| `DeliveryJobRepository` | Order ID, job state, assignment state, milestone timestamps | Assigned driver ID, cash/remittance proof state, delivery confirmation metadata | Job-board eligibility and visible safe summary | Atomic first-claim-wins; only approved active online eligible driver; hide recipient contact/address before assignment; terminal transitions forbidden |
| `DriverLocationCache` | Assigned job/driver key, latest latitude/longitude, captured time, expiry | Accuracy/provider metadata if needed | Freshness state and route ETA | Cache only, short TTL [VERIFY]; overwrite last value; never persist trails/history; only authorized active delivery readers; clear at terminal state |
| `UploadRepository` | Opaque upload ID, uploader, purpose, private storage reference, validated media metadata, state | Resource association, review status/time, safe label | Temporary access URL, file extension | Random storage names; never store/trust raw client path/name; allowlisted purpose/MIME/signature/size; private by default; cleanup unattached files under retention policy |
| `LocationProvider` | Provider configuration and normalized request parameters | Cache metadata, attribution, provider response status | Address/coordinate normalization, route geometry/distance/duration | No API secrets to browser; rate limit/cache/time out; provider errors explicit; avoid confidential address disclosure; respect provider terms and attribution |
| `AdminAuditRepository` | Actor, action, target type/ID, timestamp, decision/result | Reason, request correlation ID, minimal safe context | Report metrics and audit display | Append-only audit records for approvals, suspensions, membership changes and privileged access; never log passwords, tokens, full documents, or unnecessary location data |

## Common value rules

- IDs are opaque and values are validated at every service boundary. The client never selects an owner/user ID for a privileged action.
- Money uses the approved currency and decimal precision/rounding policy [VERIFY]. API input never supplies trusted totals, fees, or applied-discount amounts.
- Timestamps use ISO 8601. Restaurant hours and booking windows use `Asia/Manila`; stored instant/timezone representation is [VERIFY] database-design territory.
- PSGC codes are stored only if approved as the address source of truth. Coordinates are optional when a user enters an address manually and must be range-validated.
- Restaurant status, account status, membership status, application status, and order/job status are separate state dimensions; do not overload a single generic `status`.
- API responses omit internal persistence IDs, storage paths, password/security data, unrelated users' fields, and stale/unauthorized delivery coordinates.

## Decisions that must precede persistence implementation

1. User/account fields and verification/recovery requirements.
2. Restaurant business identity/document requirements, exact application form fields, and edit-triggered reapproval policy.
3. Driver identity/document requirements and reapproval criteria after sensitive edits.
4. Reservation duration, timezone encoding, hold duration, and cancellation boundary.
5. Cart TTL/inventory reservation rules, money rounding, fees, tax, and delivery pricing source.
6. Driver job eligibility/concurrency rules, cash handling/remittance fields, proof requirements, location ping interval/cache TTL, and retention.
7. Upload retention/deletion schedule and legal hold behavior.
8. Audit retention and account-deletion/data-subject request handling after privacy review.
