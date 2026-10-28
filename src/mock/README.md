# Mock data

This directory contains fabricated records and preview-only values for the frontend. Keep sample accounts, restaurants, orders, locations, dashboard metrics, promotions, and other demonstration content here rather than embedding records in screens or service logic.

Pages and components should request data through `src/services`. When connecting a backend, replace the mock-backed implementations in those services with API calls while preserving their exported methods and response shapes where practical. The UI can then continue using the same service boundary without importing fixtures.

## Fixture inventory

| File | Preview data | Current adapter |
| --- | --- | --- |
| `accounts.js` | Demo accounts, legacy demo credentials, email aliases, and verification code | `authService` |
| `customerHomeData.js`, `landingData.js` | Customer-home content, landing filters, reservation preview | `restaurantService` |
| `dashboardData.js` | Owner, admin, and rider records, metrics, and chart values | `ownerService`, `adminService`, `riderService` |
| `locationData.js`, `locationSettings.js`, `locations/philippines.js` | Default map/address values, preview place results, fees, and address hierarchy | `locationService`, `addressService` |
| `orderFlowData.js`, `restaurants.js` | Restaurants, menus, profile, saved addresses, orders, reservations, and order progression | `restaurantService`, `addressService` |

Search `src/services` for imports from `../mock` to find the remaining fixture dependencies before removing this directory. Also replace preview-only browser storage and behavior (including demo authentication and automatic order progression) as part of backend integration; deleting the fixtures alone does not connect the app to a backend.

Do not use demo credentials, fixture addresses, or fabricated operational data in production.
