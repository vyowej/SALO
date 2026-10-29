# SALO Business API Contract (v1, draft)

Source of truth for the restaurant-owner and staff workspace. The backend (`/api/v1/business/*`) and the frontend mock adapters must return the same JSON. If either side needs a change, update this file first.

No database yet: the backend uses in-memory repository stubs and the frontend mock keeps state in memory for the session. Both load the same fabricated fixture records. Restaurant membership is a per-restaurant relationship; the platform role remains a capability on the user account.

## 1. Conventions

- All routes are under `/api/v1/business`, require Sanctum auth, and require an active restaurant membership (`owner`, `manager`, `cashier`, `kitchen`, or `staff`). Non-members -> 404; wrong membership position -> 403. This contract reuses the existing membership structure and maps business positions to the same record set used by the admin phase.
- JSON keys are `snake_case`. IDs and `*_id` values are opaque strings. Timestamps are ISO 8601 UTC strings or local `Asia/Manila` values with offset; dates are `YYYY-MM-DD`; times are `HH:MM`.
- Money is a number or decimal-compatible number in PHP pesos, never a string.
- Photos are never sent as binary data. They are `photo_ref` strings that the frontend `photoStore` resolves to an image.
- Single resource: `{ "data": { ... } }`.
- List: `{ "data": [ ... ], "meta": { "current_page": 1, "per_page": 15, "total": 42, "last_page": 3 } }`.
- Delete: `204 No Content`. Action endpoints return the updated resource.
- Errors: `401/403/404 { "message": "..." }` and `422 { "message": "...", "errors": { "field": ["..."] } }`.

## 2. Role mapping and permissions

The existing membership roles are `owner`, `manager`, `cashier`, `kitchen`, and `staff`. They map to the existing restaurant membership model and permission list used elsewhere in the app:

| Position | Data shape | Permission intent |
| --- | --- | --- |
| `owner` | active membership on restaurant | full restaurant edit, menu, orders, reservations, staff, reports, calendar |
| `manager` | active membership on restaurant | full operations except owner-only staff change |
| `cashier` | active membership on restaurant | orders, payments, reservations, table assignment, no menu editing |
| `kitchen` | active membership on restaurant | orders status changes for prep and completion, menu item read-only |
| `staff` | active membership on restaurant | reservations, table view, menu reading, limited order actions |

The admission rule is: identity and existing membership structure win; the business contract only defines the operational behavior. If the codebase already defines a membership role like `reservation_manager` or `staff`, keep it and translate to the business matrix.

## 3. Resource shapes

### Dashboard

`GET /dashboard`

```json
{
  "data": {
    "totals": { "orders": 64, "revenue": 18800.5, "reservations": 12, "items_sold": 184 },
    "orders_per_day": [{ "date": "2026-10-20", "orders": 8, "revenue": 540.0 }],
    "orders_by_status": [{ "status": "pending", "count": 12 }],
    "top_items": [{ "id": "menu_123", "name": "Adobo Bowl", "orders": 18, "revenue": 2200.0 }],
    "pending_orders": [{ "id": "ord_1001", "status": "pending", "total": 540.0 }],
    "upcoming_reservations": [{ "id": "res_901", "table_label": "Table 04", "guest_count": 4, "starts_at": "2026-10-29T18:30:00+08:00" }]
  }
}
```

### Profile

`GET /profile` and `PATCH /profile`

```json
{
  "data": {
    "id": "rest_101",
    "name": "SALO Kitchen",
    "description": "Filipino comfort food and sharing plates.",
    "logo_ref": "photo:rest-101-logo",
    "cover_ref": "photo:rest-101-cover",
    "gallery": ["photo:rest-101-gallery-01", "photo:rest-101-gallery-02"],
    "cuisines": ["Filipino", "Street food"],
    "contact": { "phone": "09000000001", "email": "hello@salo.example" },
    "location": { "street_line": "88 Sample St.", "city": "Quezon City", "latitude": 14.6091, "longitude": 121.0223 },
    "service_modes": { "delivery": true, "pickup": true, "reservation": true },
    "status": "active"
  }
}
```

### Hours

`GET /hours`, `PATCH /hours`

```json
{
  "data": {
    "days": [
      { "day": "monday", "is_open": true, "open_time": "09:00", "close_time": "21:00" },
      { "day": "tuesday", "is_open": true, "open_time": "09:00", "close_time": "21:00" }
    ]
  }
}
```

Validation: each day must be either closed or have a valid opening window. A business cannot keep fewer than 4 hours open per day and fewer than 5 days per week open. The service returns the existing validation error shape when any day violates the rule.

### Menu category and item

`GET /menu`, `POST /menu/categories`, `PATCH /menu/categories/{id}`, `DELETE /menu/categories/{id}`, `POST /menu/items`, `PATCH /menu/items/{id}`, `DELETE /menu/items/{id}`

```json
{
  "data": {
    "categories": [{
      "id": "cat_1",
      "name": "Mains",
      "sort_order": 1,
      "items": [{
        "id": "item_1",
        "category_id": "cat_1",
        "name": "Adobo Bowl",
        "description": "Soy-braised chicken on rice.",
        "price": 190.0,
        "is_active": true,
        "availability": "available",
        "photo_ref": "photo:item-1",
        "option_groups": [{
          "id": "og_1",
          "name": "Add-ons",
          "required": false,
          "choices": [{ "id": "oc_1", "name": "Egg", "price": 35.0 }]
        }]
      }]
    }]
  }
}
```

### Orders

`GET /orders`, `GET /orders/{id}`, `PATCH /orders/{id}/status`

```json
{
  "data": {
    "id": "ord_1001",
    "status": "pending",
    "customer_name": "Maria Dela Cruz",
    "service_mode": "pickup",
    "items": [{ "name": "Adobo Bowl", "quantity": 2, "price": 190.0 }],
    "subtotal": 380.0,
    "fee": 0.0,
    "total": 380.0,
    "allowed_actions": ["accept", "reject", "cancel"],
    "timeline": [{ "status": "pending", "at": "2026-10-29T18:05:00+08:00" }]
  }
}
```

Transition rules are enforced server-side: `pending -> accepted -> preparing -> ready -> completed`; `cancel` is allowed only before completion; `reject` rejects the order. A restaurant must be active before it can accept or complete orders.

### Reservations and tables

`GET /reservations`, `GET /reservations/{id}`, `PATCH /reservations/{id}/status`, `POST /reservations/{id}/assign-table`, `GET /tables`, `POST /tables`, `PATCH /tables/{id}`, `DELETE /tables/{id}`, `GET /calendar`

```json
{
  "data": {
    "id": "res_901",
    "status": "confirmed",
    "guest_count": 4,
    "starts_at": "2026-10-29T18:30:00+08:00",
    "ends_at": "2026-10-29T20:00:00+08:00",
    "table_id": "tbl_4",
    "customer_name": "Maria Dela Cruz",
    "allowed_actions": ["confirm", "cancel", "seat", "complete", "no_show"]
  }
}
```

Table manager records include `label`, `capacity`, `active`, and `location`. Overlap and capacity checks are enforced on assign-table; the response returns inline validation errors when an invalid overlap is attempted.

### Staff

`GET /staff`, `POST /staff`, `PATCH /staff/{id}`

```json
{
  "data": [
    {
      "id": "usr_201",
      "name": "Sample Staff",
      "email": "staff@example.test",
      "position": "cashier",
      "status": "active",
      "added_by": "Sample Owner"
    }
  ]
}
```

The owner-only staff flow enforces the one-role rule: a user with the `owner` membership cannot also hold the platform rider capability. The owner position cannot be assigned or removed using this endpoint. New staff account creation stores a simulated hashed activation code to Laravel log and responds with `dev_activation_code` only in the local environment.

### Reports and history

`GET /reports/{report}` and `GET /history`

```json
{
  "data": {
    "series": [{ "label": "Week 1", "value": 1200.0 }],
    "summary": { "orders": 120, "revenue": 12000.0 }
  }
}
```

History records include `actor`, `subject`, `action`, `changes`, and `created_at` for every write operation.

## 4. Route registry

| Method and URL | Request | Success `data` | Allowed |
|---|---|---|---|
| `GET /v1/business/dashboard` | — | dashboard summary | owner/manager/cashier/kitchen/staff with active membership |
| `GET /v1/business/orders` | optional filters | paginated orders | same |
| `GET /v1/business/orders/{id}` | — | order detail | same |
| `PATCH /v1/business/orders/{id}/status` | `status`, optional `reason` | updated order | same |
| `GET /v1/business/menu` | — | categories and items | same |
| `POST /v1/business/menu/categories` | `name`, `sort_order` | new category | owner/manager |
| `PATCH /v1/business/menu/categories/{id}` | partial fields | updated category | owner/manager |
| `DELETE /v1/business/menu/categories/{id}` | — | no content | owner/manager |
| `POST /v1/business/menu/items` | item payload | new item | owner/manager |
| `PATCH /v1/business/menu/items/{id}` | partial item payload | updated item | owner/manager |
| `DELETE /v1/business/menu/items/{id}` | — | no content | owner/manager |
| `GET /v1/business/reservations` | optional filters | paginated reservations | same |
| `GET /v1/business/reservations/{id}` | — | reservation detail | same |
| `PATCH /v1/business/reservations/{id}/status` | `status`, optional `reason` | updated reservation | same |
| `POST /v1/business/reservations/{id}/assign-table` | `table_id` | updated reservation | owner/manager/cashier |
| `GET /v1/business/tables` | — | table list | same |
| `POST /v1/business/tables` | `label`, `capacity`, `active` | new table | owner/manager |
| `PATCH /v1/business/tables/{id}` | partial fields | updated table | owner/manager |
| `DELETE /v1/business/tables/{id}` | — | no content | owner/manager |
| `GET /v1/business/calendar` | optional `start`, `end` | calendar events | same |
| `GET /v1/business/profile` | — | restaurant profile | same |
| `PATCH /v1/business/profile` | profile fields | updated profile | owner/manager |
| `GET /v1/business/hours` | — | weekly schedule | same |
| `PATCH /v1/business/hours` | full schedule payload | updated schedule | owner/manager |
| `GET /v1/business/staff` | — | members list | owner/manager |
| `POST /v1/business/staff` | `name`, `email`, `position` | created user/member | owner |
| `PATCH /v1/business/staff/{id}` | `position`, `status` | updated membership | owner |
| `GET /v1/business/reports/{report}` | optional filters | report payload | owner/manager |
| `GET /v1/business/history` | optional filters | paginated history | owner |

## 5. Existing-route reconciliation

The current app has platform capability checks and admin patterns already in place. The business contract intentionally keeps the existing identity model and membership shape. Duplicate or out-of-contract roles and routes should be dropped by default unless they are required for the operational flow above.

## 6. Implementation note

This contract is intentionally scoped to the restaurant business workspace. It does not include customer checkout, rider operations, admin review flows, or any database-backed persistence. The backend stays in-memory only, and the frontend mock mode remains the default preview path.
