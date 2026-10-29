# SALO backend

Laravel API foundation for SALO. This phase implements session-based authentication, password reset and email verification, `/me`, customer profile and settings, account deactivation, and customer-owned saved addresses.

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

Password reset and email verification tokens are stored as session-scoped hashes through an in-memory repository. The local `.env.example` mailer writes notifications to the Laravel log; configure an approved mail transport before deploying. Token delivery and account storage are development stubs, not production-ready persistence.

## Tests and checks

```powershell
php artisan test
vendor/bin/pint --test
php artisan route:list --path=api/v1
```

Do not run database setup or migration commands. Persistent storage requires an approved database design and repository implementation.
