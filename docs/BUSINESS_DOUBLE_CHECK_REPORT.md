# Business Double-Check Report

## Result

B8 is **partly complete**. The frontend lint/build, responsive route sweep, and a short keyboard-navigation smoke check passed. The two changed PHP test files pass PHP syntax checks, but the backend suite could not start because this machine has PHP 8.0.30 while the installed Composer platform check requires PHP >= 8.4.1. No migrations were run.

The browser checks used the current running frontend and its configured mock mode. They verify rendering and basic navigation, not a live Laravel/MySQL integration.

## Route and permission map

The Business UI is mounted at `/business/*` and requires the restaurant-owner capability to enter the workspace. Within it, `useCan` controls page actions using the effective membership `permissions[]`.

The current API routes are under `/api/v1/manage/restaurants/{restaurant}`, protected by authentication and `restaurant.access` middleware. This differs from the approved `/api/v1/restaurants/{restaurant}/...` contract and should be reconciled before relying on the API contract.

| Business API route(s), relative to `/api/v1/manage/restaurants/{restaurant}` | Required permission |
|---|---|
| `GET /business`, `GET /business/profile`, `GET /business/preview`, `GET /business/photos`, `GET /business/hours`, `GET /business/closures`, `GET /business/publish-checklist` | `restaurant.view` |
| `PATCH /business/profile` | `restaurant.page.edit` |
| `PATCH /business/sensitive-profile` | `restaurant.sensitive.edit` |
| `POST /business/photos`, `PATCH /business/photos/{photo}`, `DELETE /business/photos/{photo}` | `restaurant.photos.manage` |
| `PUT /business/hours`, `POST /business/closures`, `DELETE /business/closures/{closure}` | `restaurant.hours.manage` |
| `POST /business/publish`, `/business/unpublish`, `/business/close`, `/business/deactivate`, `/business/reactivate` | `restaurant.publish` |
| `GET /team` | `team.view` |
| `POST /team/email-check`, `/team/invitations`, `/team/invitations/{invitation}/resend`; `DELETE /team/invitations/{invitation}`; `PATCH /team/{membership}`; `DELETE /team/{membership}`; `POST /team/transfer-ownership` | `team.manage` |
| `GET /audit` | `audit.view` |
| `GET /menu` | `restaurant.view` |
| `POST /menu/categories`, `PATCH/DELETE /menu/categories/{category}`, `POST /menu/items`, `POST /menu/items/bulk-publish`, `PATCH /menu/items/{item}`, `POST /menu/items/{item}/photo`, `POST /menu/halal-certificate` | `restaurant.menu.manage` |
| `DELETE /menu/items/{item}` (archive) | `restaurant.menu.manage` |
| `PATCH /menu/items/{item}/availability` | `menu.availability.manage` |
| `GET /orders`, `GET /orders/{order}` | `orders.view` |
| `PATCH /orders/{order}/status` | `orders.status.update` |
| `GET/POST /tables`, `PATCH/DELETE /tables/{table}` | `tables.manage` |
| `GET /reservations`, `GET /reservations/{reservation}`, `GET /business/reservation-settings` | `reservations.view` |
| `PATCH /reservations/{reservation}/status`, `POST /reservations/{reservation}/reschedule`, `PUT /business/reservation-settings` | `reservations.manage` |
| `GET/POST /discounts`, `PATCH/DELETE /discounts/{discount}` | `discounts.manage` |
| `GET /reports/{report}` and `GET /reports/{report}/export` | Route middleware checks `restaurant.view`; `RestaurantPagePolicy::viewReport` additionally requires `reports.reservations.view` for `reservations` and `no_show_rate`, otherwise `reports.sales_reservations.view`. |
| `GET /calendar` | Route middleware checks `restaurant.view`; `RestaurantPagePolicy::viewCalendar` authorizes the calendar. Reservation events are included only when the caller can view reservations. |

`EnsureRestaurantMembership` also requires the authenticated user's active Business mode, the selected restaurant to match the route restaurant, an active membership, and the route permission; writes are denied for suspended/inactive states except the documented Owner reactivation path.

The principal UI surfaces checked were `/business`, `/business/profile`, `/business/profile/edit`, `/business/photos`, `/business/hours`, `/business/publish`, `/business/team`, `/business/history`, `/business/menu`, `/business/orders`, `/business/reservations`, `/business/reservations?tab=tables`, `/business/reservations?tab=settings`, `/business/tables`, `/business/discounts`, `/business/reports`, and `/business/calendar`.

## Business rules mapped to implementation and tests

| Rule group | Service / enforcement | Existing test coverage |
|---|---|---|
| Application isolation and private application documents | Application controllers/services and restaurant membership | `RestaurantApplicationIsolationTest` |
| Restaurant membership, roles, invitations, expiration/single-use, ownership transfer, audit visibility, and removed-member access | `TeamService`, `RestaurantAccessPolicy`, `EnsureRestaurantMembership` | `TeamAndAuditTest` |
| Profile changes, sensitive-field review, activation state, publish checklist | `RestaurantPageService`, `RestaurantPagePolicy`, `EnsureRestaurantMembership` | `RestaurantPageTest` |
| Menu permissions, price-change confirmation, archives, certificates/photos, daily quantity reset | `MenuService`, `RestaurantPagePolicy` | `MenuManagementTest` |
| Order restaurant isolation, permitted transitions, actor visibility, cancellation, unanswered-order expiry | `BusinessOrderService`, `RestaurantPagePolicy`, `CancelUnansweredOrders` | `BusinessOrderManagementTest` |
| Table/settings/reservation validation, availability, rescheduling, status transitions, hold expiry and no-show grace | `BusinessReservationService`, `ReservationAvailabilityService` | `BusinessReservationManagementTest` |
| Discount validation and quote/eligibility rules | `BusinessDiscountService`, `DiscountQuoteService` | `BusinessDiscountReportingTest`, `DiscountQuoteServiceTest` |
| Role-scoped reports, CSV export and calendar event composition | `BusinessReportService`, `BusinessCalendarService`, `RestaurantPagePolicy` | `BusinessDiscountReportingTest` |
| Menu upload MIME/size/type validation | `MenuService` and Laravel file validation | `MenuManagementTest` (including unsupported, oversized, and fake-MIME cases) |

The newly added B8 assertions are in `TeamAndAuditTest` (Manager restrictions, invalid transfer password, 72-hour expiry, cross-restaurant role membership, and access after removal) and `MenuManagementTest` (upload validation).

## Scheduler jobs

| Command | Schedule | Purpose |
|---|---|---|
| `salo:expire-team-invitations` | Every 15 minutes | Expire pending team invitations |
| `salo:prune-audit-logs` | Daily | Prune retained audit history |
| `salo:reset-menu-quantities` | Every minute; one server; overlap lock | Reset daily menu quantities at the configured shift/Manila-day boundary |
| `salo:cancel-unanswered-orders` | Every minute; one server; overlap lock | Cancel unanswered placed orders |
| `salo:expire-pending-reservations` | Every minute; one server; overlap lock | Expire pending reservation holds |

The order auto-cancel and reservation-expiry commands have related feature coverage, but the scheduler itself was not executed in this environment.

## Verification performed

- Frontend lint: passed.
- Frontend production build: passed; Vite reported the existing large-chunk advisory.
- Responsive browser sweep: 17 Business routes/tabs at 375, 768, 1280, and 1920 px (68 checks); every route rendered a heading, no horizontal overflow was detected, and there were no page errors.
- Keyboard smoke check: the first 10 Tab stops on the table-inventory view reached the workspace link, search, navigation controls, Business tabs, and table search inputs with `:focus-visible`. This is not a full keyboard audit of every modal and action.
- TanStack table inventory: rendered with 3 rows in the current mock data.
- PHP syntax: `TeamAndAuditTest.php` and `MenuManagementTest.php` passed `php -l`.
- Backend test suite: **not run**. `php artisan test` stops at Composer's platform check (required PHP >= 8.4.1; available PHP 8.0.30).
- Database migrations: not run, consistent with the no-migration-before-approval rule.

## Gaps, assumptions, and follow-up

- **API base-path mismatch:** routes and frontend API path helpers use `/api/v1/manage/restaurants/{restaurant}/...`, not the required `/api/v1/restaurants/{restaurant}/...`. This report records the mismatch; no route rewrite was made in B8.
- **Unverified by test execution:** all backend feature/unit tests, database behavior, migration compatibility, and live API/frontend integration.
- **Missing explicit acceptance coverage:** the acceptance checklist calls for two simultaneous reservations yielding exactly one winner; current availability tests cover overlapping bookings sequentially, not a concurrency race. Add a database-backed concurrency test before treating that guarantee as proven.
- **Out of scope/not demonstrated:** Business mode cannot initiate Customer checkout; checkout/redemption integration remains outside the Business implementation.
- **Owner departure:** no Owner-leave endpoint appears in the current Business route set, so the “last Owner cannot leave” behavior has no route-level acceptance test.
- Suspended read-only behavior is covered in page and order tests and enforced in shared middleware, but was not re-tested across every Business endpoint because the backend suite could not run.
- Browser verification used mock mode. Real API response states, file storage, role switching, and database-backed behavior still require hand testing in a compatible environment.
- The mobile overflow fix and table inventory use the existing design tokens and TanStack Table. Keyboard verification was a smoke check, not an exhaustive accessibility assessment.
