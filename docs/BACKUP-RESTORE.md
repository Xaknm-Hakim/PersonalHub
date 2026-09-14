# PostgreSQL backup and restore

`scripts/backup-pg.sh [database]` creates a PostgreSQL custom-format (`pg_dump -Fc`) archive from the isolated overhaul Compose service. PostgreSQL makes the dump MVCC-consistent; the app is not stopped. The script requires the explicit overhaul environment, writes through a partial file, requires a nonempty dump, and validates the archive with `pg_restore -l` before publishing it under `backups/postgres/`.

`scripts/restore-pg.sh archive.dump [database]` validates the archive before any mutation, then requires the exact confirmation `RESTORE database`. It takes a separately verified safety dump before replacing the target. If the isolated overhaul app was running, it is stopped during replacement and restarted afterward. The scripts address only `docker-compose.overhaul.yml`; they do not operate on SQLite or the legacy port-3001 service.

Use a unique disposable database for restore rehearsals. Never overwrite a populated database unless replacement is deliberate and the safety archives are retained outside the project machine.

## Verified rehearsal

On 2026-09-15, the repository scripts were exercised against separate disposable source and target PostgreSQL databases. The source contained one Task, one Project, one Tag, and one task-tag join. The custom dump passed `pg_restore -l`; restore produced 1/1/1/1 count parity and an identical content fingerprint. A target-only sentinel row was absent afterward, proving the target was replaced rather than merged. Both disposable databases and rehearsal archives were removed after verification.
