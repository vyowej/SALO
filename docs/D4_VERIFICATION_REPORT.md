# D4 Final Verification Report

**Date:** 2026-11-04  
**Scope:** Corrective work limited to the three approved D4 findings and their
regression tests. No database schema, migrations, or D5 work was changed.

## Outcome

**The three corrective findings are fixed and covered by regression tests.**
D4 is ready for implementation approval, but this is not production map
approval: successful OSM tile delivery and production Referer/cache behavior
remain unverified, and the public tile service has no availability SLA.
No D5 work, schema changes, or unrelated application changes were made.

## Verification results

| Area | Result |
|---|---|
| Rider GPS eligibility | **Pass.** Backend eligibility remains restricted to the assigned rider and active delivery. On a location API 403/404, Rider UI stops the watch, blocks queued callbacks from submitting, clears local position, and displays an ineligibility reason. Generic/network failures remain `upload-error` and do not stop the watch. |
| Storage and expiry | **Pass.** The live point is written through Laravel `Cache` only, to delivery-specific and dispatch-location keys, with a 120-second TTL. No live-point database write or GPS history was found. The initial coordinate supplied when going online is also stored in the dispatch cache for rider dispatch; it is not the delivery tracking endpoint. |
| Customer privacy and authorization | **Pass.** Tracking uses the customer-owned order lookup. Feature tests confirm the owner can retrieve the point and another customer receives 404. The response includes no rider profile/contact fields; tracking location itself contains coordinates and timestamp. Terminated deliveries return no live point. |
| Cache cleanup | **Pass.** Terminal model updates capture the previous rider ID before save and defer cleanup until commit. Regression tests verify delivered/failed cleanup with retained rider ID, failed status with simultaneous unassignment, cancellation with unassignment, removal of both target keys, and preservation of another rider's active location keys. |
| Map coordinates and tile failure | **Pass in browser simulation.** Both map components now request the canonical `https://tile.openstreetmap.org/{z}/{x}/{y}.png` endpoint and preserve OSM attribution. Requests were intentionally aborted to verify the error message; successful tile delivery and production policy compliance remain unverified. Missing coordinates keep an explicit unavailable state. |
| External navigation | **Source inspection only.** Google Maps uses a directions URL with the destination coordinate pair; Waze uses its `ul` URL with `ll` and `navigate=yes`. Destination coordinates were absent from the mock delivery, so these links were not rendered in the browser run. No external URL was opened. Actual navigation is unverified and is not claimed. |
| Frontend states and responsive layout | **Automated tests plus browser simulation.** Rider tests cover offer privacy, acceptance, active-delivery GPS start, ineligible stop, queued callback suppression, temporary network errors, retry, and no duplicate watcher. Customer tests cover live point and unavailable point. Browser mock-mode simulation verified clearWatch, no later submission, one watcher on retry, canonical tile host, map-unavailable message, and 360/390/768/1280px widths. No horizontal overflow was measured. |
| Customer browser/API experience | **Not fully verified.** Automated Customer tracking tests use mocked API responses. The API-mode browser page had no authenticated customer session and returned 401 for an address request, so an authenticated customer tracking request was not exercised in a real browser session. |

### Confirmed findings

1. **Original finding — OSM tile URL. Corrective action:** changed both
   `MapView.jsx` and `DeliveryTrackingMap.jsx` to the canonical
   `https://tile.openstreetmap.org/{z}/{x}/{y}.png` URL in the official
   [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
   (checked 2026-11-04); visible attribution is preserved. No production
   readiness is claimed: real tile delivery, hosting headers/Referer behavior,
   usage limits, and OSM service availability are not verified; the public
   service has no SLA.
2. **Original finding — GPS continues after ineligibility. Corrective action:**
   `RiderPage` now treats the API's 403/404 as loss of eligibility, calls
   `clearWatch`, clears the local point, guards queued callbacks against any
   later submission, clears the server point, and displays a stop reason.
   Generic/network errors do not stop the watch. Retry starts a fresh watcher
   after the old watcher is stopped; physical-device behavior remains
   unverified.
3. **Original finding — terminal cleanup relies on updated `rider_id`.
   Corrective action:** the `Delivery` model records the previous rider ID
   during `updating` for terminal status changes, then uses that captured ID
   for after-commit cleanup. Tests cover retained and nulled rider IDs,
   delivered/failed/cancelled statuses, both target keys, and isolation of a
   second rider's active delivery keys.

### Cleanup notes

- Delivery terminal-state handling clears the delivery key and dispatch key
  using the rider ID captured before terminal update. Order cancellation
  retains its existing explicit pre-unassignment cleanup.
- Profile cleanup scans deliveries currently assigned in `offered`, `accepted`,
  and `picked_up` states. The scheduled eligibility scan runs each minute, so
  eligibility cleanup is not necessarily immediate; the location endpoint
  independently rejects updates when it observes an ineligible profile.
- Frontend clear requests run on GPS error, hidden-page transition, delivery
  change, ineligibility, and component cleanup. Temporary network errors remain
  retryable without marking the rider ineligible.

## Tests and checks executed

| Command/check | Result |
|---|---|
| `php artisan test --filter=RiderDispatchTest` | **Pass:** 22 tests, 109 assertions |
| `php artisan test` | **Pass:** 191 tests, 1,234 assertions |
| `npm test -- --run src/pages/Rider/RiderPage.test.jsx src/pages/OrderDetail/OrderDetailPage.test.jsx` | **Pass:** 3 test files, 17 tests, including configured `src/App.test.jsx` |
| `npm run lint` | **Pass:** ESLint exit code 0 |
| `npm run build` | **Pass:** Vite production build; 2,694 modules transformed |
| `git diff --check` | **Pass:** exit code 0; Git emitted existing line-ending conversion warnings only |
| Browser simulation at `http://127.0.0.1:5175` | **Pass for simulated behavior:** mock Rider flow accepted an offer, stubbed GPS, verified ineligibility status and `clearWatch`, and confirmed a queued callback did not increase submissions. Retry created one fresh watcher. The browser requested `tile.openstreetmap.org`; requests were deliberately aborted and showed the map unavailable message. Widths 360, 390, 768, and 1280px showed no horizontal overflow. Not a real-device GPS test. |

The browser's deliberately aborted tile requests generated expected network
failures and the map-unavailable status. In a separate API-mode page without
an authenticated session, the browser logged an expected 401 while attempting
to load an address. Successful OSM tile rendering, actual device permissions,
background behavior on a physical device, authenticated customer API traffic,
and external navigation were not verified.

## Database safety

Before database-backed tests:

1. Inspected `backend/.env.testing`: `DB_CONNECTION=mysql`,
   `DB_DATABASE=salo_test`, `CACHE_STORE=array`.
2. Inspected PHPUnit overrides and Laravel configuration:
   `database.default=mysql`,
   `database.connections.mysql.database=salo_test`.
3. Ran a guarded `SELECT DATABASE()` through the bootstrapped Laravel testing
   configuration. Output confirmed `default=mysql`,
   `configured_database=salo_test`, and `selected_database=salo_test`.

The backend test bootstrap also enforces a `testing` environment and a database
name ending in `_test`. No test was run against `salo`; no live database was
accessed. No schema changes, migrations, destructive SQL, or database resets
were run.

## Files inspected or modified

**Modified for the three corrective findings:**

- `src/components/location/MapView.jsx`
- `src/components/location/DeliveryTrackingMap.jsx`
- `src/pages/Rider/RiderPage.jsx`
- `src/pages/Rider/RiderPage.test.jsx`
- `backend/app/Models/Delivery.php`
- `backend/tests/Feature/RiderDispatchTest.php`
- `docs/DRIVER_SIDE.md`
- `docs/FRONTEND_API_MAPPING.md`
- `docs/D4_VERIFICATION_REPORT.md`

These are the files changed for this corrective task. Other pre-existing
uncommitted D4 and unrelated work was preserved and not reverted.

**Related implementation and tests inspected:** `backend/app/Services/RiderLocationCache.php`,
`backend/app/Services/RiderDispatchService.php`,
`backend/app/Services/CustomerOrderService.php`,
`backend/app/Services/AuthService.php`,
`backend/app/Services/ActiveModeService.php`,
`backend/app/Services/RiderSchedulingService.php`,
`backend/app/Models/Delivery.php`,
`backend/app/Http/Controllers/Api/V1/Rider/RiderDispatchController.php`,
`backend/app/Http/Requests/Rider/RiderLocationUpdateRequest.php`,
`backend/routes/api.php`,
`backend/tests/Feature/RiderDispatchTest.php`,
`backend/tests/Support/RiderDispatchFixtures.php`,
`src/pages/Rider/RiderPage.jsx`,
`src/pages/Rider/RiderPage.test.jsx`,
`src/pages/OrderDetail/OrderDetailPage.jsx`,
`src/pages/OrderDetail/OrderDetailPage.test.jsx`,
`src/components/location/DeliveryTrackingMap.jsx`,
`src/components/location/DeliveryTrackingMap.css`,
and `src/services/riderService.js`.

**Additional behavior/configuration inspection:** `src/App.jsx`,
`src/config.js`, `src/services/authService.js`,
`src/components/location/MapView.jsx`,
`backend/app/Services/RiderApplicationService.php`,
`backend/app/Services/RiderSchedulingService.php`,
`backend/app/Console/Commands/DispatchReadyDeliveries.php`,
`backend/routes/console.php`, and `backend/config/database.php`.

**Safety/configuration inspected:** `backend/.env.testing`,
`backend/phpunit.xml`, `backend/tests/TestCase.php`,
`backend/tests/bootstrap.php`, and the backend test database guards.

**D5:** Not started.
