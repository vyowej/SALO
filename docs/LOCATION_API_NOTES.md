# Location API integration notes

The app selects mock data when `VITE_USE_MOCK` is not `false`; location fixtures live under `src/mock/locations`. The single frontend service interface is `src/services/locationService.js`. In API mode it calls the backend location endpoints only; React does not call geocoding providers.

## Service-to-endpoint mapping

| Service function | Provider integration point |
| --- | --- |
| `getRegions()` | `GET /api/v1/locations/psgc?level=region`; local PSGC table |
| `getProvinces(regionCode)` | Local PSGC query by region parent; optional prefix-ranked type-ahead |
| `getCities(parentCode)` | Local PSGC query by province or direct-region parent (NCR/independent city cases) |
| `getBarangays(cityCode)` | Local PSGC query constrained to selected city/municipality |
| `searchLocations(query, level, parentCode)` | `GET /api/v1/locations/psgc/search?query=...`; ranked hierarchy matches, optional level and parent filters |
| `searchPlaces(query)` | `GET /api/v1/locations/places/search`; optional backend Geoapify integration, limited to PH |
| `reverseGeocode(lat, lng)` | `POST /api/v1/locations/places/reverse`; backend-only Nominatim single lookup, with local PSGC resolution |
| `getCurrentPosition()` | Browser Geolocation API; permission is requested only after an explicit user action |
| `getDistanceKm(from, to)` | Local Haversine calculation; no network endpoint |
| `estimateDeliveryFee(distanceKm, restaurant)` | Local calculation using `src/mock/locationSettings.js`; replace with the future pricing API |

The client must not call geocoding/autocomplete providers directly or hold provider keys. All provider requests pass through the backend `LocationService` contract, implemented by `PsgcLocationService`; keys remain in `backend/.env`, are never hard-coded, and are not sent to the browser. Geoapify street search is limited to country code `ph`, has a bounded result limit and timeout, and is disabled until `LOCATION_GEOAPIFY_API_KEY` is configured. Nominatim is used only for one reverse lookup per action, with a configured custom User-Agent, at most one request per second enforced by a shared cache lock, successful-result caching, and a timeout. Replace the sample User-Agent in `backend/.env.example` with a deployment-specific identifier and maintainer contact. No Nominatim autocomplete exists. Manual street entry remains available if a provider is unconfigured or unavailable. The coarse pin bounds are shared from `public/location-bounds.json`; exact Philippine boundary checking remains deferred [VERIFY].

Before production, verify Geoapify free-tier limits, terms/attribution, geographic coverage, retention/processing location, and privacy impact. Also verify Nominatim terms, attribution, and deployment cache sharing/rate-limit behavior [VERIFY]. Do not silently fall back to mock data in API mode.

All address forms use Country, Province, City or Municipality, Barangay, Street, House number. Country displays Philippines, is locked for now, and is stored as `country_code="PH"`. Requiredness and intended schema columns were confirmed by the owner; owner-edited v3 and database readiness are still gates. PSGC `city` rows cover both cities and municipalities. Province, city, and barangay values come only from the local PSGC table. Reverse geocoding resolves hierarchically by code: match the region first, then a province beneath that region when present, then a city beneath the matched province or directly beneath the region, and finally a barangay beneath the matched city. Child matches are constrained to the already-matched parent; an unverified component remains unresolved rather than being inferred from a name elsewhere.

Reverse-geocode names are compared after trimming, lowercasing, collapsing whitespace, stripping punctuation and diacritics, and treating leading `City of ` / trailing ` City` as equivalent. The only configured provider-region aliases are `Metro Manila` and `National Capital Region`, both mapped to PSGC region `NCR`; other provider spellings are not assumed. Barangay candidates are tried in this order: `neighbourhood`, `neighborhood`, `quarter`, `suburb`, `village`, then `hamlet`; the first candidate matching a PSGC barangay under the matched city is used. District fields are not treated as provinces unless they match a PSGC province row under the matched region.

Persist one barangay leaf code and derive ancestors. NCR city/municipality rows are children of the NCR region and skip province selection with display text `Metro Manila (NCR)`; independent cities such as Zamboanga City are direct children of their region and skip province selection with `None (independent city)`. The UI clears and reloads lower fields when a parent changes. Current-location reverse geocoding and map-pin dragging refresh editable fields; resolve administrative divisions against local PSGC. The final formatted address is shown and stored.

## Map component replacement contract

`MapView` accepts `{ center, pin, onPinChange, markers }`. `center` and `pin` are `{ latitude, longitude }`; `onPinChange(nextPin)` receives the same shape. `markers` is an array of coordinate objects. The current mock implementation is a static SVG map with a draggable/keyboard-adjustable pin; a real map provider can replace this component without changing page call sites.

## Delivery configuration

The mock fee and default range are in `src/mock/locationSettings.js`. Restaurant fixtures set their own `delivery_radius_km`. These are preview values, not production pricing or coverage.
