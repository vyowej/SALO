# SALO backend

Laravel API foundation for SALO. Implemented areas include session-based authentication, password reset and email verification, `/me`, customer profile and settings, account deactivation, saved addresses, and the admin API.

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

The backend uses in-memory repository stubs for account and address data. This phase intentionally contains no migrations, seeders, factories, SQL, or database persistence. Stub-backed accounts and addresses are temporary and can be lost when the server restarts or the session ends; this is not production storage.

Admin data follows the same in-memory-only constraint. Admin writes use services and in-memory repositories; no migrations, seeders, factories, SQL, or database persistence are part of the admin implementation.

The business workspace follows the same rule. Restaurant ownership, staff permissions, daily schedules, menu records, orders, reservations, and reports are implemented as in-memory stubs behind service and repository layers. The contract for those endpoints is in [BUSINESS_API_CONTRACT.md](./BUSINESS_API_CONTRACT.md).

## Admin API

The admin API includes dashboard, user and restaurant management, partner/rider application review, riders and proof references, order cancellation, reservation status changes, reports, history, calendar, settings, service areas, and schedules. The exact routes, payloads, response shapes, fixtures, and business rules are maintained in [ADMIN_API_CONTRACT.md](./ADMIN_API_CONTRACT.md).

Admin fixture records are development-only and do not create login credentials. Requests still require an authenticated account with the existing `admin` capability.

Password reset and email verification tokens are stored as session-scoped hashes through an in-memory repository. The local `.env.example` mailer writes notifications to the Laravel log; configure an approved mail transport before deploying. Token delivery and account storage are development stubs, not production-ready persistence.

## Tests and checks

```powershell
php artisan test
vendor/bin/pint --test
php artisan route:list --path=api/v1
```

Do not run database setup or migration commands. Persistent storage requires an approved database design and repository implementation.
