# SALO Role and Permission Matrix

**Status:** Phase A proposal. Authorization design only; no code or database schema is created here.

## Identity and authorization model

- One person has one account. Customer is granted automatically; `driver` and `admin` are platform capabilities.
- `owner`, `manager`, `reservation_manager`, and `staff` are membership roles scoped to one restaurant. They are not platform capabilities and must not be stored as account-wide roles.
- A user may hold memberships at multiple restaurants. Every restaurant-scoped request must resolve the requested restaurant, verify an active membership for that restaurant, and check its effective permission. UI visibility is not authorization.
- A centralized `PermissionMap` is the authoritative role-to-permission mapping. `/auth/me`, route middleware, policies, and invitation role validation use the same mapping. Never duplicate grants in controllers or client code.
- Admin is a separate, audited platform capability and is not an implicit restaurant membership. Customer ownership and driver assignment checks apply in addition to the matrix.

## Proposed permission keys

| Permission | Scope and intended actions |
|---|---|
| `restaurant.view` | Read authorized restaurant profile and operations summaries |
| `restaurant.edit` | Edit restaurant profile, service modes, opening hours, accepting-orders state |
| `menu.manage` | Create/update/archive categories, menu items, options, availability and pricing |
| `orders.view` | Read restaurant orders and operational details needed by staff |
| `orders.manage` | Advance/cancel orders under the state machine; record required reason |
| `reservations.view` | Read restaurant reservations |
| `reservations.manage` | Confirm, complete, cancel, or mark no-show under policy |
| `tables.manage` | Create/update/remove restaurant tables subject to history constraints |
| `discounts.manage` | Manage restaurant-funded discounts |
| `team.manage` | Invite, update, suspend, or remove non-owner restaurant members |
| `analytics.view` | Read restaurant dashboard metrics |

These are proposed stable identifiers, not a claim that the existing frontend already enforces them. Any new key or grant change requires contract and test updates.

## Role grants

| Capability / membership role | Restaurant-scoped permissions | Additional limits |
|---|---|---|
| Customer | None by membership | Read own profile, addresses, carts, orders, reservations; submit own restaurant/driver applications |
| Owner membership | All permissions listed above | Only Owner can manage staff and invite another Owner; Owners cannot transfer ownership. Owner additions and Manager ownership-change requests requiring Owner confirmation are blocked until the root schema represents them. Cannot grant platform admin/driver. |
| Manager membership | `restaurant.view`, `restaurant.edit`, `menu.manage`, `orders.view`, `orders.manage`, `reservations.view`, `reservations.manage`, `tables.manage`, `discounts.manage`, `analytics.view` | No `team.manage`; may request an ownership change for Owner confirmation, but cannot change ownership directly. Request flow is blocked until schema support exists. |
| Reservation manager membership | `restaurant.view`, `reservations.view`, `reservations.manage`, `tables.manage` | No access to menu pricing, discounts, team, or order/customer data beyond what is necessary for reservations |
| Staff membership | `restaurant.view`, `menu.manage`, `orders.view`, `orders.manage`, `reservations.view` | Cannot alter restaurant profile/hours, manage reservations, tables, discounts, analytics, or team |
| Driver capability | No restaurant membership permission | Can set own availability, browse safe unclaimed job summaries, claim eligible jobs, access assigned-job details, update assigned milestones/location |
| Admin capability | Platform operations explicitly listed in API contract | Access is audited; admin does not bypass reason, privacy, and minimum-data requirements |

## Resource and privacy checks

1. For a restaurant endpoint, URL restaurant ID is authoritative only after existence lookup and membership-policy check; nested resource must belong to that same restaurant.
2. A removed, suspended, expired, or inactive membership grants no access. Revocation is effective on the next request.
3. Restaurant membership permissions never grant access to another restaurant or another customer's account-level history.
4. Customer endpoints verify the authenticated user owns the address, cart, order, reservation, or checkout group.
5. Driver endpoints verify approved active driver capability and, where applicable, the current assignment. Job-board responses omit customer identity, phone, exact address, and rider note until claim succeeds.
6. Driver tracking is only accessible for an active relevant delivery to the assigned driver, owning customer, authorized restaurant member with `orders.view`, and audited admin operations. Do not retain location history.
7. Invitation creation and role changes are owner-only. Invite acceptance requires an authenticated matching email, valid unexpired token, and active target restaurant. Invitations cannot grant owner, driver, or admin.
8. Self-role escalation, removing/demoting the last owner, transfer of restaurant ownership, owner membership suspension, and admin impersonation are [VERIFY] policy decisions. Until approved, disallow these mutations.

## `/auth/me` response expectation

`GET /api/v1/auth/me` returns a minimal user object, active account status, platform `capabilities[]`, memberships each containing `restaurant_id`, `role`, `status`, and effective `permissions[]`, plus driver approval/availability state when applicable. It must not include invitation secrets, credentials, private application documents, or unrelated business data. The client must derive navigation and mode switching from these returned grants; server policy checks remain mandatory.

## Review and validation requirements

- Confirm exact permission keys and role grants before implementation.
- Feature-test every permission for both allow and deny cases, including cross-restaurant ID substitution, stale membership, and nested-resource mismatch.
- Verify `/auth/me` and authorization policy share one `PermissionMap`; permission response changes must be reflected after membership changes without requiring a new account.
