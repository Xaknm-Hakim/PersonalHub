# Migration verification record — 2026-09-15

No protected legacy SQLite file was modified. The rehearsal copied the protected recovery snapshot and imported only that copy into a uniquely named disposable PostgreSQL database.

## Protected source

`backups/overhaul-safety-20260910-193400/legacy-snapshot.db`

- protected SHA256: `67e27f14640d0fbb60df0eb246e630c748656aa2185e5efe64d25643044aff00`
- source-copy SHA matched: yes
- read-only SQLite `PRAGMA integrity_check`: `ok`

## Rehearsal result

The importer returned `verified: true` after source/target parity checks inside its transaction.

| Table             | Source | Target |
| ----------------- | -----: | -----: |
| Task              |      0 |      0 |
| Assignment        |      0 |      0 |
| Project           |      5 |      5 |
| Note              |      0 |      0 |
| Tag               |      5 |      5 |
| `_TaskTags`       |      0 |      0 |
| `_AssignmentTags` |      0 |      0 |
| `_NoteTags`       |      0 |      0 |

All five source project IDs were present in PostgreSQL and all five project rows passed field-level verification. Verified target null counts included one null project `startDate`, two null `targetDate` values, two null `completedAt` values, five null `repositoryUrl` values, and two null `nextAction` values. The five tag IDs were preserved. The source had no task, assignment, note, or join rows, so relationship parity for those tables was correctly zero rather than synthesized.

The disposable target was removed after verification. Neither `data/personalhub.db`, the protected recovery snapshot, nor the normal overhaul PostgreSQL database was used as an import target.

## Import safety and semantics

`scripts/migrate-sqlite-to-postgres.ts`:

- reads SQLite through a read-only URI;
- validates required legacy tables and columns;
- supports known nullable columns present in the recovery snapshot;
- rejects unknown enum values and malformed dates/timestamps;
- treats SQLite integer and zone-less timestamps as UTC instants;
- interprets planning-date instants in `LEGACY_PLANNING_TIMEZONE` (default `Asia/Kuala_Lumpur`), while preserving written date-only values;
- preserves completion timestamps as instants rather than converting them to planning dates;
- refuses a nonempty target;
- imports entities and joins in one PostgreSQL transaction;
- verifies counts, IDs, scalar/null values, dates, timestamps, foreign keys, and joins before commit; and
- rolls back on verification or import failure.

Synthetic integration coverage additionally exercises populated entities and relationships, rollback, nonempty-target refusal, and unknown-enum safeguards.
