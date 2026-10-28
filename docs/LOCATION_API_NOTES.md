# Location API integration notes

The app currently selects `mock` with `VITE_LOCATION_PROVIDER=mock`. Location fixtures live under `src/mock/locations`, and the service interface is in `src/services/locationService.js`.

## Service-to-endpoint mapping

| Service function | Provider integration point |
| --- | --- |
| `getRegions()` | PSGC regions collection (`{VITE_PSGC_BASE_URL}/regions/`) — **URL to verify before use** |
| `getProvinces(regionCode)` | PSGC provinces by region (`/regions/{regionCode}/provinces/`) — **URL to verify before use** |
| `getCities(provinceCode)` | PSGC cities/municipalities by province (`/provinces/{provinceCode}/cities-municipalities/`) — **URL to verify before use** |
| `getBarangays(cityCode)` | PSGC barangays by city/municipality (`/cities-municipalities/{cityCode}/barangays/`) — **URL to verify before use** |
| `searchPlaces(query)` | Google Places Autocomplete (`VITE_MAPS_API_KEY`) or Nominatim Search — **URL and usage policy to verify before use** |
| `reverseGeocode(lat, lng)` | Google Geocoding or Nominatim Reverse — **URL, key restrictions, and usage policy to verify before use** |
| `getCurrentPosition()` | Browser Geolocation API; permission is requested only after an explicit user action |
| `getDistanceKm(from, to)` | Local Haversine calculation; no network endpoint |
| `estimateDeliveryFee(distanceKm, restaurant)` | Local calculation using `src/mock/locationSettings.js`; replace with the future pricing API |

Set `VITE_PSGC_BASE_URL` to a verified PSGC-compatible base URL and `VITE_MAPS_API_KEY` only in a local environment file when integrating a real provider. Do not commit provider secrets. The non-mock adapters are intentionally not enabled yet; selecting one reports that it is not implemented rather than silently falling back to mock data.

## Map component replacement contract

`MapView` accepts `{ center, pin, onPinChange, markers }`. `center` and `pin` are `{ latitude, longitude }`; `onPinChange(nextPin)` receives the same shape. `markers` is an array of coordinate objects. The current mock implementation is a static SVG map with a draggable/keyboard-adjustable pin; a real map provider can replace this component without changing page call sites.

## Delivery configuration

The mock fee and default range are in `src/mock/locationSettings.js`. Restaurant fixtures set their own `delivery_radius_km`. These are preview values, not production pricing or coverage.
