# SALO Schema Gap Report — F1 source and live check

**Authority:** [database/salo_db.sql](../database/salo_db.sql) is the sole schema source of truth. The former [DATABASE_SCHEMA_V3.sql draft](./archive/DATABASE_SCHEMA_V3.sql) is archived and superseded. The root SQL was not edited or executed.

**Safety:** The root SQL starts with `DROP DATABASE IF EXISTS salo; CREATE DATABASE salo;`. Never execute it against the live `salo` database. F1 ran read-only metadata checks only; no migration, DDL, seed, import, or data-changing SQL was run.

## F1 findings

- The checked-in root SQL currently declares **50 tables**, with **50 distinct names**; no duplicate `CREATE TABLE` declarations were found. The earlier F1 live comparison recorded 49 tables in `salo`, so the current `co_owner_requests` declaration has not been verified against the live database by this F2 work.
- The prior F1 report recorded that all 49 then-compared declarations existed in the configured live MariaDB 10.11.16 database `salo`. F2 did not connect to or inspect live `salo`.
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

An earlier F1 review identified a multiple-Owner representation gap. The
current checked-in root SQL now includes `owner` in `restaurant_staff.staff_role`
and `invitations.staff_role`, plus the `co_owner_requests` table. This F2 work
did not query live `salo`; the earlier live comparison covered 49 tables and
does not establish whether the current `co_owner_requests` declaration is
present there. Do not infer live-schema support from the root file alone.

## Rider schema proposals

### Proposal 1 — [DECLINED] Date-specific rider shift rosters

**Status:** Declined by the owner on 2026-11-02. Do not apply this SQL.

**Reason:** Rider shifts remain recurring assignments in the existing
`rider_shift_assignments` table, keyed by rider and shift. The approved rider
features do not require date-specific roster rows.

**Feature:** Would only have been needed for one-off calendar-date shift
scheduling, cancellations, or days off. No current rider feature requires it.

Exact SQL preserved for the declined proposal:

```sql
CREATE TABLE rider_shift_rosters (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rider_id            BIGINT UNSIGNED NOT NULL,
  zone_id             BIGINT UNSIGNED NULL,
  shift_id            BIGINT UNSIGNED NOT NULL,
  shift_date          DATE NOT NULL,
  status              ENUM('assigned','waitlisted','cancelled') NOT NULL,
  assigned_by         ENUM('system','admin') NOT NULL DEFAULT 'system',
  assigned_by_user_id BIGINT UNSIGNED NULL,
  reason              VARCHAR(255) NULL,
  created_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roster_rider_shift_date (rider_id, shift_id, shift_date),
  KEY idx_roster_capacity (zone_id, shift_id, shift_date, status),
  CONSTRAINT chk_roster_zone
    CHECK (status <> 'assigned' OR zone_id IS NOT NULL),
  CONSTRAINT fk_roster_rider
    FOREIGN KEY (rider_id) REFERENCES rider_profiles (id),
  CONSTRAINT fk_roster_zone
    FOREIGN KEY (zone_id) REFERENCES zones (id),
  CONSTRAINT fk_roster_shift
    FOREIGN KEY (shift_id) REFERENCES shifts (id),
  CONSTRAINT fk_roster_assigned_by
    FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
) ENGINE=InnoDB;
```

### Proposal 2 — Persist the last known rider location

**Status:** Proposed; not approved or implemented.

The Admin Riders UI previously showed a `last_position` value, but
`database/salo_db.sql` has no persistent rider-location table or columns. The
dispatch service keeps the latest coordinates in cache, which is not a
database-backed or durable source for the Admin directory. The API therefore
returns `last_position: null` rather than presenting home coordinates or
delivery-proof coordinates as a live position.

**Proposal:** Approve a durable per-rider last-location record containing
latitude, longitude, and update time, with a rider foreign key and an index
supporting latest-location reads. No schema change is authorized by this
proposal.

### Proposal 3 — Persist rider activation time

**Status:** Proposed; not approved or implemented.

`rider_profiles` has `approved_at` but no activation timestamp. Approval time
is not activation time. Successful OTP activation writes a
`rider_activation_verified` audit row, but audit logs are subject to retention
and pruning, so they are not a durable activation-time source. The directory
returns `activated_at: null` when that event is unavailable.

**Proposal:** Add a nullable activation timestamp to `rider_profiles`, set
only when the existing OTP activation succeeds. No schema change is
authorized by this proposal.

## Next-step boundary

F1 was documentation and read-only verification. F2 added a guarded test-schema
loader and successfully ran its dry run against the empty `salo_test`; no DDL
or seed INSERT was executed. `backend/phpunit.xml` remains unchanged. Do not
apply the printed statements or start D1 until separately approved.
