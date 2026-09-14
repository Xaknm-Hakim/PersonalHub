#!/bin/sh
# Restore only a verified custom archive into the isolated overhaul PostgreSQL service.
set -eu
file="${1:?Usage: scripts/restore-pg.sh backups/postgres/file.dump [database]}"
database="${2:-${PERSONALHUB_PG_DATABASE:-personalhub}}"
test -f "$file" || { echo "Backup not found: $file" >&2; exit 2; }
case "$database" in *[!A-Za-z0-9_]*|'') echo "Unsafe database name" >&2; exit 2;; esac
: "${PERSONALHUB_POSTGRES_PASSWORD:?Load .env.overhaul explicitly}"
compose='docker compose --env-file .env.overhaul -f docker-compose.overhaul.yml'
# Validate the input before confirmation, safety backup, stopping the app, or touching a database.
$compose exec -T postgres pg_restore -l < "$file" >/dev/null || { echo "Invalid PostgreSQL custom archive; nothing changed." >&2; exit 2; }
printf 'Restore verified archive into isolated database "%s". Type RESTORE %s: ' "$database" "$database"
IFS= read -r answer
test "$answer" = "RESTORE $database" || { echo "Cancelled; nothing changed."; exit 0; }
# Keep a second recovery point before replacement. pg_dump is MVCC-consistent; no service is stopped for backup.
./scripts/backup-pg.sh "$database"
was_running=$($compose ps --status running -q app || true)
restart_app() { if [ -n "$was_running" ]; then $compose start app >/dev/null || echo "WARNING: app restart failed; start it with docker compose ... start app" >&2; fi; }
trap restart_app EXIT HUP INT TERM
if [ -n "$was_running" ]; then $compose stop app >/dev/null; fi
# PostgreSQL admin connection is separate from the target, so replacement cannot race an app connection.
$compose exec -T postgres sh -ceu 'dropdb -U personalhub --if-exists "$1"; createdb -U personalhub "$1"' sh "$database"
$compose exec -T postgres pg_restore -U personalhub --exit-on-error --no-owner --no-privileges --dbname="$database" < "$file"
$compose exec -T postgres pg_isready -U personalhub -d "$database" >/dev/null
echo "Restore completed for isolated database: $database"
