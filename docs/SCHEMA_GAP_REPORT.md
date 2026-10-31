# SALO Schema Gap Report — F1 source and live check

**Authority:** [database/salo_db.sql](../database/salo_db.sql) is the sole schema source of truth. The former [DATABASE_SCHEMA_V3.sql draft](./archive/DATABASE_SCHEMA_V3.sql) is archived and superseded. The root SQL was not edited or executed.

**Safety:** The root SQL starts with `DROP DATABASE IF EXISTS salo; CREATE DATABASE salo;`. Never execute it against the live `salo` database. F1 ran read-only metadata checks only; no migration, DDL, seed, import, or data-changing SQL was run.

## F1 findings

- The root SQL declares **49 tables**, with **49 distinct names**; no duplicate `CREATE TABLE` declarations were found.
- All 49 declared tables exist in the configured live MariaDB 10.11.16 database `salo`.
- Read-only `SHOW COLUMNS` comparison found matching column names, types, and nullability for all 49 tables. MariaDB's display normalization accounts for JSON (`LONGTEXT`) and equivalent timestamp/numeric defaults. **No column differences were found.**
- The comparison was limited to `SHOW COLUMNS`; exhaustive parity for every index, foreign key, check constraint, trigger, and table option is not claimed.
- The Laravel migration-history table was absent. No migration was applied.

## Approved address fields present in the root schema

| Requirement | Root SQL definition |
|---|---|
| Country | `country_code` on `user_addresses`, `restaurants`, `rider_profiles`, and `orders.delivery_country_code`. |
| PSGC selection | One `psgc_code` on an address-bearing record; user addresses and restaurants require it. `psgc_locations.parent_code` has a self-referencing foreign key. |
| Street | NOT NULL on `user_addresses` and `restaurants`; nullable for draft rider profiles. |
| House number | Nullable `house_no` on `user_addresses`, `restaurants`, and `rider_profiles`. |
| Formatted address | `formatted_address` on user addresses, restaurants, and rider profiles; rider draft value is nullable. Orders retain `delivery_address_text`. |
| One default address | `uq_addr_one_default` uses the generated default-owner key on `user_addresses`. |
| Rider submitted-address constraint | `chk_rider_address_when_submitted` is declared. |

These database constraints do not validate that a PSGC value is barangay-level or that it matches UI-selected ancestors; the API must validate that hierarchy.

## Known product/schema gap

The approved product rule permits several Owners per restaurant: an Owner cannot transfer ownership but can add another Owner; a Manager may request an ownership change that waits for an Owner's confirmation. The root schema currently has one required `restaurants.owner_user_id`, no Owner value in `restaurant_staff.staff_role`, no owner-invitation relation, and no ownership-request representation. Do not implement or enable these workflows until the schema owner decides how to represent them. Do not silently use legacy transfer behavior.

## Next-step boundary

F1 is documentation and read-only verification only. The dedicated `salo_test` proposal belongs to F2 and has not been applied. Do not start F2 or later steps until separately approved.
