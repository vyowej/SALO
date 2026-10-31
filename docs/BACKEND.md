# SALO backend

Laravel API for SALO, including authentication, customer accounts, restaurant applications, business workspace, orders, reservations, discounts, team access, and admin operations.

The admin API endpoints, JSON contract, and fixture requirements are defined in [ADMIN_API_CONTRACT.md](./ADMIN_API_CONTRACT.md); this overview does not duplicate their route list.

## Requirements

- PHP 8.3 or newer with the `curl`, `fileinfo`, `mbstring`, `openssl`, and `zip` extensions.
- Composer 2.
- Node.js and npm for the frontend.

## Local setup

From `backend/`:

```powershell
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan serve --host=127.0.0.1 --port=8000
```

In another terminal, from the repository root:

```powershell
npm install
$env:VITE_USE_MOCK = "false"
$env:VITE_SALO_API_URL = "http://localhost:8000/api/v1"
npm run dev
```

Open the frontend at `http://localhost:5173`. The API allows credentialed requests from the configured `CORS_ALLOWED_ORIGINS` and `SANCTUM_STATEFUL_DOMAINS` in `backend/.env`.

The backend uses database-backed repositories and Eloquent models. The configured production schema is an existing MariaDB database; it was inspected read-only during this work. Tests use an isolated in-memory SQLite database.

The Laravel migrations have not been applied to the populated MariaDB database. Its migration-history table is absent, and the repository migrations are not a safe baseline for that database. Do not run `migrate`, `migrate:install`, or the destructive SQL blueprint against it. See [MIGRATION_BASELINE.md](./MIGRATION_BASELINE.md) before any future schema adoption.

## Admin API

The admin API includes dashboard, user and restaurant management, partner/rider application review, riders and proof references, order cancellation, reservation status changes, reports, history, calendar, settings, service areas, and schedules. The exact routes, payloads, response shapes, fixtures, and business rules are maintained in [ADMIN_API_CONTRACT.md](./ADMIN_API_CONTRACT.md).

Admin fixture records are development-only and do not create login credentials. Requests still require an authenticated account with the existing `admin` capability.

Password reset and email verification tokens are stored as hashes in the database. Configure an approved mail transport before deploying.

## Tests and checks

```powershell
php artisan test
vendor/bin/pint --test
php artisan route:list --path=api/v1
```

Run tests only against their configured isolated SQLite database. Do not run database setup or migration commands against the populated MariaDB database; schema adoption requires a reviewed baseline and an approved backup/rollback plan.
