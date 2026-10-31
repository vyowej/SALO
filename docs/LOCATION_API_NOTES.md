# Location API integration notes

The app currently selects `mock` with `VITE_LOCATION_PROVIDER=mock`. Location fixtures live under `src/mock/locations`, and the service interface is in `src/services/locationService.js`.

## Service-to-endpoint mapping

| Service function | Provider integration point |
| --- | --- |
| `getRegions()` | Backend PSGC proxy over the regions collection — upstream URL must be verified before use |
| `getProvinces(regionCode)` | Backend PSGC proxy, type-ahead by region parent |
| `getCities(parentCode)` | Backend PSGC proxy, type-ahead by province or direct-region parent (NCR/independent city cases) |
| `getBarangays(cityCode)` | Backend PSGC proxy, type-ahead constrained to selected city/municipality |
| `searchLocations(query, level, parentCode)` | Backend PSGC hierarchy search, returning qualified hierarchy and enforcing parent filters |
| `searchPlaces(query)` | Backend-only Philippines-limited street/landmark autocomplete; evaluate Geoapify first, Photon and LocationIQ as alternatives [VERIFY limits/terms/privacy] |
| `reverseGeocode(lat, lng)` | Backend-only single lookup; Nominatim may be used for reverse geocoding only under its policy [VERIFY] |
| `getCurrentPosition()` | Browser Geolocation API; permission is requested only after an explicit user action |
| `getDistanceKm(from, to)` | Local Haversine calculation; no network endpoint |
| `estimateDeliveryFee(distanceKm, restaurant)` | Local calculation using `src/mock/locationSettings.js`; replace with the future pricing API |

The client must not call geocoding/autocomplete providers directly or hold provider keys. All provider requests pass through the backend behind the single `locationService` interface; keys remain in `backend/.env`, are never hard-coded, and are not sent to the browser. Provider requests are PH-limited, timed out/rate-controlled, and return normalized data or an explicit error. Send only the minimum address/coordinate data required, never SALO user IDs, and disclose third-party transfers. Evaluate Geoapify first for street/landmark autocomplete, with Photon and LocationIQ as alternatives. For each, verify free-tier limits, terms/attribution, geographic coverage, retention/processing location, and privacy impact [VERIFY]. Do not use a provider for type-ahead unless its terms allow it. Nominatim is for a single reverse-geocoding lookup only: custom User-Agent, at most one request per second per application, caching, timeout, and applicable terms/attribution [VERIFY]. Do not use Nominatim for autocomplete. Manual address entry and draggable pin remain available; provider availability is not a C1 gate. Do not silently fall back to mock data.

All address forms use Country, Province, City or Municipality, Barangay, Street, House number. Country displays Philippines, is locked for now, and is stored as `country_code="PH"`. Requiredness and intended schema columns were confirmed by the owner; owner-edited v3 and database readiness are still gates. PSGC `city` rows cover both cities and municipalities. Province, city, and barangay values come only from the local PSGC table. Persist one barangay leaf code and derive ancestors. NCR city/municipality rows are children of the NCR region and skip province selection with display text `Metro Manila (NCR)`; independent cities such as Zamboanga City are direct children of their region and skip province selection with `None (independent city)`. The UI clears and reloads lower fields when a parent changes. Current-location reverse geocoding and map-pin dragging refresh editable fields; resolve administrative divisions against local PSGC. The final formatted address is shown and stored.

## Map component replacement contract

`MapView` accepts `{ center, pin, onPinChange, markers }`. `center` and `pin` are `{ latitude, longitude }`; `onPinChange(nextPin)` receives the same shape. `markers` is an array of coordinate objects. The current mock implementation is a static SVG map with a draggable/keyboard-adjustable pin; a real map provider can replace this component without changing page call sites.

## Delivery configuration

The mock fee and default range are in `src/mock/locationSettings.js`. Restaurant fixtures set their own `delivery_radius_km`. These are preview values, not production pricing or coverage.
