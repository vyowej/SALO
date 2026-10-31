# Safe database migration baseline

## Current state

The configured database `salo` is an existing MariaDB 10.11.16 database with application data. Its Laravel `migrations` table was not present when inspected. The eight checked-in migrations contain non-idempotent table creation and definitions that differ from confirmed live columns, keys, and enums.

No migration, schema install, or data-changing SQL was run during the schema review. In particular, do not run any of the following against `salo`:

- `php artisan migrate`
- `php artisan migrate:install`
- `php artisan migrate:fresh` or `migrate:refresh`
- `docs/DATABASE_SCHEMA_V3.sql` (it begins by dropping and recreating the database)

The repository migrations are useful source code but are not an adoption baseline for the populated database. A missing migration history does not mean the database is empty.

## Safe adoption process

1. **Protect and verify recovery.** Take a database backup using the approved operational process and verify that it can be restored to an isolated instance. Record the current schema version and deployment owner.
2. **Capture the actual schema.** Export `SHOW CREATE TABLE` for every table and read-only `information_schema` metadata for columns, generated expressions, indexes, foreign keys, checks, triggers, and table options. Record table/row counts without exporting customer data.
3. **Resolve semantic gaps before writing migrations.** Reconcile each live column with its application meaning. Do not map fields just because their names look similar. Current examples include the absent `restaurants.category` column and the lack of an independent `discounts.first_order_only` column.
4. **Create and review a baseline for fresh installs.** Ensure the migration sequence creates a schema matching the approved design on a disposable MariaDB instance. Validate constraints and generated columns against the supported MariaDB version.
5. **Adopt existing databases separately.** Compare every table and constraint in the approved baseline to the live schema. Only after an exact, reviewed match should an operator create migration-history metadata and mark that baseline as applied. Do not mark the current create-table migrations applied while their definitions still differ, and do not let them execute against existing tables.
6. **Test forward changes on a restored clone.** Apply only reviewed, additive or otherwise explicitly approved migrations. Verify data counts, key relationships, generated columns, and representative application reads/writes before and after. Rehearse rollback or restore before production approval.
7. **Deploy with explicit approval.** Schedule an operator-reviewed deployment with a verified backup and rollback plan. Keep production schema inspection read-only until that approval is given.

## Safe development checks

`php artisan test` is configured to use an isolated in-memory SQLite database. Keep tests on that connection; do not point test setup at `salo`. PHP and route checks that do not alter the database are safe to run separately.

For the current live schema, discount requests with `first_order_only=true` are rejected because the column is not represented in the database. Restaurant category persistence likewise needs an agreed mapping to the existing cuisine model before it can be enabled. These behaviors must not be changed by silently dropping eligibility or category data.
