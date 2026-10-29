# SALO Admin API Contract (v1, draft)

Source of truth for the admin feature set. The backend (`/api/v1/admin/*`) and the frontend mock adapters must return the **same JSON**. If either side needs a change, update this file first and say so in the report.

No database yet: the backend uses in-memory repository stubs; the frontend mock keeps state in memory for the session. Both load the same fabricated fixture records (see section 4).

## 1. Conventions

- All routes are under `/api/v1/admin`, require Sanctum auth and the existing `admin` platform capability. Guest -> 401, non-admin -> 403.
- JSON keys are `snake_case`. IDs and `*_id` values are opaque strings; the client must not assume a format. Existing in-memory repositories use UUIDs. Timestamps are ISO 8601 UTC strings (`2026-10-29T08:30:00Z`); dates are `YYYY-MM-DD`; times are `HH:MM`.
- Money is a number in PHP pesos with 2 decimals (`149.5`), never a string.
- Photos are never sent as image data. They are a `photo_ref` string: a browser localStorage key that the frontend `photoStore` resolves to an image.
- Single resource: `{ "data": { ... } }`.
- List: `{ "data": [ ... ], "meta": { "current_page": 1, "per_page": 15, "total": 42, "last_page": 3 } }`.
- Delete: `204 No Content`. Actions (suspend, approve, ...) return the updated resource.
- Errors: `401/403/404 { "message": "..." }` and `422 { "message": "...", "errors": { "field": ["..."] } }`.
- If the existing backend already uses a different envelope, keep the existing one and keep the field names below.

### List query parameters (all list endpoints)

| Param | Meaning |
| --- | --- |
| `page`, `per_page` | default 1 and 15, max `per_page` 100 |
| `search` | free-text match on the main text fields of the resource |
| `sort`, `direction` | field name and `asc` or `desc` (default newest first) |
| other filters | flat params named in each endpoint below (`capability`, `restaurant_id`, `status`, ...) |

Mock adapters must implement the same search, sort, filter and pagination behavior through one shared helper, `paginate(items, params)`.

## 2. Resource shapes

### Dashboard

`GET /dashboard`

```json
{
  "data": {
    "totals": { "users": 25, "restaurants": 8, "riders": 6, "orders": 40, "revenue": 18250.5 },
    "orders_per_day": [{ "date": "2026-10-01", "orders": 4, "revenue": 1320.0 }],
    "orders_by_status": [{ "status": "completed", "count": 28 }],
    "top_restaurants": [{ "id": "00000000-0000-4000-8000-000000000003", "name": "Sample Grill", "orders": 12, "revenue": 5400.0 }],
    "new_users_per_week": [{ "week_start": "2026-10-19", "count": 5 }]
  }
}
```

`orders_per_day` covers the last 30 days; `top_restaurants` has up to 5 rows.

### User

`GET /users` (filters: `capability`, `restaurant_id`, `status`), `GET /users/{id}`, `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}`, `POST /users/{id}/suspend` (`{ "reason": "..." }` optional), `POST /users/{id}/reactivate`

```json
{
  "id": "00000000-0000-4000-8000-000000000007",
  "name": "Sample User", "email": "sample.user@example.test", "phone": "09000000000",
  "avatar_url": null, "status": "active", "capabilities": ["customer"],
  "memberships": [], "driver_state": null,
  "email_verified_at": "2026-10-02T09:00:00Z", "created_at": "2026-10-01T08:00:00Z"
}
```

The existing user resource fields remain unchanged: `id, name, email, phone, avatar_url, status, capabilities, memberships, email_verified_at, driver_state`; this admin representation adds `created_at`. `capabilities` uses the existing platform capabilities (`customer`, `driver`, `admin`). Restaurant roles (including `owner`) remain membership roles and use the existing membership shape. `status`: `active | deactivated | suspended | pending_activation`. Create body: `name, email, phone?, capabilities, password`. Update body: those fields are optional; `password` is optional.

### Restaurant

`GET /restaurants` (filters: `status`, `city_code`), `GET /restaurants/{id}`, `POST /restaurants`, `PUT /restaurants/{id}`, `DELETE /restaurants/{id}`, `PATCH /restaurants/{id}/status` (`{ "status": "active", "note": "..." }`)

```json
{
  "id": "00000000-0000-4000-8000-000000000003", "name": "Sample Grill", "slug": "sample-grill",
  "description": "Placeholder description.",
  "owner": { "id": "00000000-0000-4000-8000-000000000012", "name": "Sample Owner" },
  "phone": "09000000001", "email": "grill@example.test",
  "logo_ref": "photo:rest-3-logo", "cover_ref": "photo:rest-3-cover",
  "address": {
    "street_line": "Placeholder St.", "city_code": "0972200000",
    "city_name": "Zamboanga City", "latitude": 6.9214, "longitude": 122.0790
  },
  "categories": ["Filipino", "Grill"], "status": "active",
  "accepts_delivery": true, "accepts_pickup": true, "accepts_reservations": true,
  "rating_avg": 4.3, "rating_count": 18, "created_at": "2026-10-01T08:00:00Z"
}
```

`status`: `pending | active | paused | suspended`. `logo_ref` and `cover_ref` map to the `logo_path` and `cover_path` columns later.

### Application (partner and rider)

`GET /applications` (filters: `type` = `partner|rider`, `status`), `GET /applications/{type}/{id}`, `POST /applications/{type}/{id}/approve` (`{ "note": "..." }` optional), `POST /applications/{type}/{id}/reject` (`{ "note": "..." }` required)

```json
{
  "id": "00000000-0000-4000-8000-000000000004", "type": "rider", "status": "pending",
  "applicant": { "id": "00000000-0000-4000-8000-000000000020", "name": "Sample Rider", "email": "rider.sample@example.test" },
  "submitted_at": "2026-10-20T10:00:00Z",
  "reviewed_by": null, "reviewed_at": null, "review_note": null,
  "details": {
    "birth_date": "2002-05-14", "vehicle_type": "motorcycle", "plate_no": "ABC 1234",
    "license_no": "N00-00-000000", "tin_no": "000-000-000",
    "service_area_city_code": "0972200000",
    "payout": { "provider": "GCash", "name": "Sample Rider", "account_masked": "****0000" }
  },
  "documents": [{
    "id": "00000000-0000-4000-8000-000000000009", "doc_type": "clearance", "photo_ref": "photo:app-4-clearance",
    "status": "submitted", "note": null
  }]
}
```

Partner `details`: `business_name, business_type, business_address, city_code, latitude, longitude, contact_phone, cuisine_summary, payout`. Rider `details`: as above. `status`: `draft | pending | approved | rejected`. `doc_type`: `business_registration | business_permit | valid_id | clearance | drivers_license | or_cr | vehicle_photo | selfie`. Approving a rider application grants the existing `driver` platform capability and creates a rider record with status `pending_activation`. Approving a partner application creates the restaurant with status `active` and adds the existing `owner` membership for the applicant. A user cannot have an owner membership and the `driver` capability at the same time; enforce this on user creation/update and application approval. Payout numbers are masked in the API.

### Rider

`GET /riders` (filters: `status`), `GET /riders/{id}`, `PATCH /riders/{id}/status` (`{ "status": "active" | "suspended" }`), `GET /riders/{id}/proofs`

```json
{
  "id": "00000000-0000-4000-8000-000000000020", "name": "Sample Rider", "email": "rider.sample@example.test",
  "phone": "09000000002", "status": "active",
  "vehicle_type": "motorcycle", "plate_no": "ABC 1234", "is_online": true,
  "last_position": { "latitude": 6.93, "longitude": 122.08, "seen_at": "2026-10-29T08:10:00Z" },
  "earnings": { "total": 3200.0, "this_week": 640.0, "deliveries_count": 41 },
  "activated_at": "2026-10-21T09:00:00Z", "resigned_at": null,
  "created_at": "2026-10-20T10:00:00Z"
}
```

`status`: `pending_activation | active | resigned | suspended`. `last_position` may be null.

Proofs (`GET /riders/{id}/proofs`, plain list, paginated):

```json
{
  "id": "00000000-0000-4000-8000-000000000005", "delivery_id": "00000000-0000-4000-8000-000000000031", "order_number": "SALO-0031", "stage": "dropoff",
  "photo_ref": "photo:proof-31-dropoff", "latitude": 6.93, "longitude": 122.08,
  "taken_at": "2026-10-29T08:20:00Z"
}
```

### Order and reservation (read only except cancel / status change)

`GET /orders` (filters: `status`, `fulfilment`, `restaurant_id`, `from`, `to`), `GET /orders/{id}`, `POST /orders/{id}/cancel` (`{ "reason": "..." }`, required)

List item:

```json
{
  "id": "00000000-0000-4000-8000-000000000031", "order_number": "SALO-0031", "status": "completed", "fulfilment": "delivery",
  "customer": { "id": "00000000-0000-4000-8000-000000000007", "name": "Sample User" },
  "restaurant": { "id": "00000000-0000-4000-8000-000000000003", "name": "Sample Grill" },
  "total": 389.0, "payment_method": "cod", "payment_status": "paid",
  "placed_at": "2026-10-29T07:50:00Z"
}
```

Detail adds:

```json
{
  "subtotal": 349.0, "delivery_fee": 40.0, "discount_total": 0.0,
  "cancelled_by": null, "cancel_reason": null,
  "delivery_address_text": "Placeholder St., Zamboanga City",
  "rider": { "id": "00000000-0000-4000-8000-000000000020", "name": "Sample Rider" },
  "items": [{
    "item_name": "Sample Meal", "quantity": 2, "unit_price": 174.5,
    "line_total": 349.0, "note": null,
    "options": [{ "group_name": "Size", "choice_name": "Large", "price_delta": 20.0 }]
  }],
  "status_history": [{
    "status": "placed", "changed_by": null, "note": null,
    "created_at": "2026-10-29T07:50:00Z"
  }]
}
```

`status`: `placed | accepted | preparing | ready | out_for_delivery | delivered | completed | cancelled | rejected`. `payment_method`: `cod | pay_at_pickup | online_bank`. `payment_status`: `pending | paid | refunded | void`.

Order cancellation is allowed only when the status is not `completed`, `cancelled`, or `rejected`; otherwise return 422. Cancellation sets `status` to `cancelled`, `cancelled_by` to `admin`, and `cancel_reason` to the required reason. Append an order `status_history` entry and an activity history entry, then return the updated order.

`GET /reservations` (filters: `status`, `restaurant_id`, `from`, `to`), `GET /reservations/{id}`, `PATCH /reservations/{id}/status` (`{ "status": "...", "reason": "..." }`; `reason` is optional except required for `cancelled`)

```json
{
  "id": "00000000-0000-4000-8000-000000000002", "code": "RSV-0002", "status": "confirmed",
  "customer": { "id": "00000000-0000-4000-8000-000000000007", "name": "Sample User" },
  "restaurant": { "id": "00000000-0000-4000-8000-000000000003", "name": "Sample Grill" },
  "table": { "id": "00000000-0000-4000-8000-000000000005", "label": "Table 5" },
  "party_size": 4, "reserved_for": "2026-11-02T18:30:00Z", "duration_minutes": 90,
  "contact_name": "Sample User", "contact_phone": "09000000000",
  "special_request": null, "cancelled_at": null, "cancel_reason": null
}
```

`table` may be null. `status`: `pending | confirmed | seated | completed | cancelled | no_show`. Allowed transitions: `pending` -> `confirmed` or `cancelled`; `confirmed` -> `seated`, `cancelled`, or `no_show`; `seated` -> `completed`. All other transitions return 422. Set cancellation details when cancelled, record an activity history entry, and return the updated reservation.

### Reports

One uniform shape so the frontend can use one table, one chart and one CSV export. `GET /reports/sales` (`period` = `day|week|month`, `from`, `to`), `GET /reports/orders-by-status`, `GET /reports/restaurant-ranking`, `GET /reports/rider-performance` (the last three take `from`, `to`).

```json
{
  "data": {
    "title": "Sales by day", "from": "2026-10-01", "to": "2026-10-29",
    "columns": [
      { "key": "label", "label": "Date", "type": "text" },
      { "key": "orders", "label": "Orders", "type": "number" },
      { "key": "revenue", "label": "Revenue", "type": "money" }
    ],
    "rows": [{ "label": "2026-10-01", "orders": 4, "revenue": 1320.0 }],
    "totals": { "orders": 40, "revenue": 18250.5 }
  }
}
```

`type`: `text | number | money | date`. `totals` may be null. Row keys by report: sales `label, orders, revenue`; orders-by-status `label, orders`; restaurant-ranking `label (restaurant name), orders, revenue, rating_avg`; rider-performance `label (rider name), deliveries, earnings`.

### History

`GET /history` (filters: `actor_id`, `restaurant_id`, `subject_type`, `from`, `to`)

```json
{
  "id": "00000000-0000-4000-8000-000000000015", "actor": { "id": "00000000-0000-4000-8000-000000000001", "name": "Admin" }, "restaurant": null,
  "subject_type": "restaurant", "subject_id": "00000000-0000-4000-8000-000000000003", "action": "status_changed",
  "changes": { "status": { "from": "pending", "to": "active" } },
  "created_at": "2026-10-29T08:00:00Z"
}
```

`actor` or `restaurant` may be null. `changes` may be null. Every admin write records one entry.

### Calendar

`GET /calendar?from=2026-10-01&to=2026-10-31` (plain list, FullCalendar friendly)

```json
{
  "data": [
    {
      "id": "shift-12", "type": "shift", "title": "Sample Rider - Pasonanca",
      "start": "2026-10-30T08:00:00Z", "end": "2026-10-30T16:00:00Z",
      "all_day": false, "meta": { "rider_id": "00000000-0000-4000-8000-000000000020", "service_area_id": "00000000-0000-4000-8000-000000000001" }
    },
    {
      "id": "closure-3", "type": "closure", "title": "Sample Grill closed",
      "start": "2026-11-01", "end": "2026-11-01", "all_day": true,
      "meta": { "restaurant_id": "00000000-0000-4000-8000-000000000003" }
    },
    {
      "id": "reservation-2", "type": "reservation", "title": "Sample Grill - party of 4",
      "start": "2026-11-02T18:30:00Z", "end": "2026-11-02T20:00:00Z",
      "all_day": false, "meta": { "reservation_id": "00000000-0000-4000-8000-000000000002" }
    }
  ]
}
```

`type`: `shift | closure | reservation`.

### Settings

`GET /settings`, `PUT /settings` (partial update, returns all settings)

```json
{
  "data": {
    "app_name": "SALO",
    "default_delivery_fee": 40.0,
    "max_riders_per_area": 50,
    "rider_slots": [
      { "label": "Morning", "start_time": "08:00", "end_time": "14:00" },
      { "label": "Evening", "start_time": "14:00", "end_time": "22:00" }
    ]
  }
}
```

### Service areas and schedules

`GET /service-areas`, `POST /service-areas`, `PUT /service-areas/{id}`, `DELETE /service-areas/{id}`

```json
{
  "id": "00000000-0000-4000-8000-000000000001", "name": "Pasonanca", "city_code": "0972200000",
  "latitude": 6.9535, "longitude": 122.0625, "max_riders": 50, "is_active": true
}
```

`GET /schedules?date=2026-10-30` (plain list)

```json
{
  "id": "00000000-0000-4000-8000-000000000012", "rider": { "id": "00000000-0000-4000-8000-000000000020", "name": "Sample Rider" },
  "service_area": { "id": "00000000-0000-4000-8000-000000000001", "name": "Pasonanca" },
  "shift_date": "2026-10-30", "start_time": "08:00", "end_time": "14:00",
  "status": "scheduled"
}
```

`POST /schedules/generate` body `{ "date": "2026-10-30", "slots": [ { "start_time": "08:00", "end_time": "14:00" } ] }` (`slots` optional, defaults to `rider_slots` from settings):

```json
{
  "data": {
    "date": "2026-10-30",
    "assigned": [{ "rider_id": "00000000-0000-4000-8000-000000000020", "service_area_id": "00000000-0000-4000-8000-000000000001", "start_time": "08:00", "end_time": "14:00" }],
    "unassigned": [{ "rider_id": "00000000-0000-4000-8000-000000000024", "reason": "All service areas are full for this slot" }],
    "area_usage": [{ "service_area_id": "00000000-0000-4000-8000-000000000001", "start_time": "08:00", "assigned": 50, "max": 50 }]
  }
}
```

Algorithm: for each active rider without a shift in the slot, pick the nearest active service area (haversine distance from the rider's `last_position`; fall back to the area matching the rider's city) that still has capacity. When an area is full, move to the next nearest area with room. Output must be deterministic (tie-break by area id). A rider is never booked twice in the same slot.

## 3. Endpoint summary

| Group | Endpoints |
| --- | --- |
| Dashboard | GET `/dashboard` |
| Users | GET, POST `/users`; GET, PUT, DELETE `/users/{id}`; POST `/users/{id}/suspend`, `/reactivate` |
| Restaurants | GET, POST `/restaurants`; GET, PUT, DELETE `/restaurants/{id}`; PATCH `/restaurants/{id}/status` |
| Applications | GET `/applications`; GET `/applications/{type}/{id}`; POST `.../approve`, `.../reject` |
| Riders | GET `/riders`; GET `/riders/{id}`; PATCH `/riders/{id}/status`; GET `/riders/{id}/proofs` |
| Orders | GET `/orders`; GET `/orders/{id}`; POST `/orders/{id}/cancel` |
| Reservations | GET `/reservations`; GET `/reservations/{id}`; PATCH `/reservations/{id}/status` |
| Reports | GET `/reports/sales`, `/reports/orders-by-status`, `/reports/restaurant-ranking`, `/reports/rider-performance` |
| History | GET `/history` |
| Calendar | GET `/calendar` |
| Settings | GET, PUT `/settings` |
| Service areas | GET, POST `/service-areas`; PUT, DELETE `/service-areas/{id}` |
| Schedules | GET `/schedules`; POST `/schedules/generate` |

## 4. Mock rules (frontend) and fixtures (both sides)

Frontend adapters live in `src/services/admin/` with these function names, identical in mock and API mode, each returning the same JSON as the API (so `listUsers(params)` returns `{ data, meta }`):

`getDashboard`, `listUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`, `suspendUser`, `reactivateUser`, `listRestaurants`, `getRestaurant`, `createRestaurant`, `updateRestaurant`, `deleteRestaurant`, `setRestaurantStatus`, `listApplications`, `getApplication`, `approveApplication`, `rejectApplication`, `listRiders`, `getRider`, `setRiderStatus`, `listRiderProofs`, `listOrders`, `getOrder`, `cancelOrder`, `listReservations`, `getReservation`, `setReservationStatus`, `getReport`, `listHistory`, `getCalendar`, `getSettings`, `updateSettings`, `listServiceAreas`, `createServiceArea`, `updateServiceArea`, `deleteServiceArea`, `listSchedules`, `generateSchedule`.

Mock behavior:

- Fixtures live in `src/mock/admin/*.js`. State is mutable for the session, so create, edit, delete, approve, cancel-order, change-reservation-status and generate-schedule actually change what the screens show. Include at least one cancellable order and one completed/cancelled/rejected order, plus reservations in `pending`, `confirmed`, and `seated` states to exercise allowed transitions and invalid transitions.
- Mock writes also add history entries, like the backend does.
- Validation errors in mock mode use the same `422 { message, errors }` shape.
- Mock `photo_ref` values point to keys that `photoStore` seeds with tiny generated placeholder images, so the photo viewer works without uploads.

Fixture size (same records on the backend, in PHP fixture classes, so switching modes feels the same): about 25 users across capabilities and membership roles, 8 restaurants, 6 applications (mixed partner and rider, mixed status), 6 riders, 40 orders, 12 reservations, 30 days of daily stats, 3 service areas, 15 shifts, 20 history rows. All data is fabricated: sample names, `example.test` emails, dummy phone, plate and payout numbers. The demo admin is `admin@salo.app`; this is an email identifier only, not a seeded login or password.

Backend feature tests must cover an order cancellation happy path and rejection of cancellation for a terminal order, plus a reservation status-change happy path and rejection of an invalid transition. The shared fixtures include at least one cancellable and one terminal order, and reservations in `pending`, `confirmed`, and `seated` states.
