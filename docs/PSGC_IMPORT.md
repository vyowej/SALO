# PSGC data import

`database/salo_db.sql` remains authoritative and is not changed by the PSGC import workflow. The import writes PSGC rows to the existing `psgc_locations` table only; it does not create tables, delete rows, or alter the schema.

## Local API cache

From `backend/`, cache the four complete JSON datasets from the PSGC API:

| Dataset | URL |
|---|---|
| Regions | <https://psgc.gitlab.io/api/regions/> |
| Provinces | <https://psgc.gitlab.io/api/provinces/> |
| Cities and municipalities | <https://psgc.gitlab.io/api/cities-municipalities/> |
| Barangays | <https://psgc.gitlab.io/api/barangays/> |

Run `php artisan psgc:cache-api` to download those endpoints to `backend/storage/app/psgc-cache/`. This command only updates the local JSON cache; it does not connect to or write to a database. The cache may also be prepared manually by saving the responses under the same four filenames.

The API is a locally cacheable PSGC data source. Its current terms, redistribution permissions, attribution requirements, and refresh cadence have not been independently confirmed and remain **[VERIFY]**. Confirm these before production use; the import command does not bypass that review.

## Import

The import is a separate, database-writing operation and must only be run after an explicit decision to load the data into the selected database. From `backend/`, run:

```powershell
php artisan psgc:import --confirm
```

By default, this reads the four JSON files from `storage/app/psgc-cache/`. A different cache directory may be passed as the optional `source` argument. The explicit `--confirm` option is required before any database write; review the configured database connection before using it. The existing normalized CSV input is also supported with header `code,parent_code,name,level`; its rows are validated and reordered before writing.

The importer validates the complete hierarchy and computed `full_name` values before calling the repository. It writes in parent-first order (region, province, city, barangay) inside a transaction, using the existing PSGC codes. It uses upserts and does not delete database rows absent from the source snapshot.

## Hierarchy normalization

- PSGC municipalities and cities are both stored at level `city`.
- Province rows use their `regionCode` as parent. Ordinary cities/municipalities use their `provinceCode`.
- NCR has no province rows; cities and municipalities with no `provinceCode` use their `regionCode` directly.
- Independent cities with no `provinceCode` also attach directly to their region. The API currently reports Zamboanga City's `provinceCode` as Zamboanga del Sur, so code `097332000` is explicitly attached to its `regionCode` to honor the approved independent-city address behavior. Its imported name is normalized from `City of Zamboanga` to `Zamboanga City`. Review this source-specific override when refreshing against a changed PSGC dataset.
- Barangays use `cityCode` or `municipalityCode` as their parent. District and sub-municipality rows are not imported as address levels. In particular, Manila barangays use the API's `cityCode` for City of Manila, flattening their district/sub-municipality metadata so the stored hierarchy is City of Manila → Barangay.
- Each `full_name` is computed from the location name followed by its parent chain, comma-separated. Thus searches can match both the place name and its province/region hierarchy.

The schema's `psgc_locations.level` enum also permits `district` and `submunicipality`; this importer intentionally writes only the four address levels above. It does not change that enum or create separate persisted district/sub-municipality rows.

## Read-only verification

From `backend/`, run:

```powershell
php artisan psgc:verify
```

This command performs only SELECT queries. It prints row counts for each supported schema level (`region`, `province`, `city`, `barangay`, `district`, and `submunicipality`), counts rows with missing parents, counts rows whose parent level is invalid, and reports their combined invalid-parent count. A valid hierarchy returns exit code 0; any invalid-parent row returns a non-zero exit code. This report does not establish that the current database is the intended target; verify the Laravel database connection before running it.

No import or verification command was executed as part of implementing this F4 workflow.
