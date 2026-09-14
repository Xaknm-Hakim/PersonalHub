# SQLite to PostgreSQL migration

The legacy SQLite database and recovery snapshots are source artifacts only. The importer opens its input using SQLite read-only mode. Never pass `data/personalhub.db`: create a copy first, preferably with SQLite's backup API while the app is stopped or otherwise quiesced, then pass that copy to the importer. The CLI refuses the primary database path.

Run only against a new, isolated, empty PostgreSQL database:

```sh
PERSONALHUB_DATABASE_URL='postgresql://personalhub:<password>@127.0.0.1:5433/your_empty_db?schema=public' npx tsx scripts/migrate-sqlite-to-postgres.ts /path/to/sqlite-backup-copy.db
```

`PERSONALHUB_DATABASE_URL` is required. The importer never falls back to `DATABASE_URL`.

## Normalization policy

- SQLite/Prisma integer timestamps are epoch milliseconds and preserve their UTC instant, including negative epochs.
- SQLite `CURRENT_TIMESTAMP` and zone-less timestamp strings are interpreted as UTC. The importer does not silently reinterpret them as local `+08` time.
- `startDate`, `dueDate`, `targetDate`, and `Assignment.deadline` are PostgreSQL `date` values. Written `YYYY-MM-DD` values retain that calendar day after strict real-calendar validation. Timestamp-valued planning dates are converted to the configured planning timezone before selecting a calendar day.
- The planning timezone defaults to `Asia/Kuala_Lumpur`. Set `LEGACY_PLANNING_TIMEZONE` only when the legacy planning-date convention is known to differ.
- `completedAt` is a timestamp, not a planning date. Its full legacy instant is retained; UI presentation may derive a planning date separately. Null remains null and no completion timestamp is inferred from status.

## Safety and verification

The source schema, required columns, IDs, enums (including priority), foreign keys, join endpoints, and duplicate joins are checked fail-closed before import. Unknown values are rejected.

The target tables are locked and checked for emptiness inside the import transaction. Rows, IDs, scalar values, nulls, timestamps, relationships, and joins are verified with that same transaction before `COMMIT`; a failed verification rolls back every inserted row. Date verification requests PostgreSQL dates as text and timestamps as epoch values, avoiding host-timezone parser behavior.
