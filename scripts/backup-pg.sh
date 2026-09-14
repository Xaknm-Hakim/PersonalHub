#!/bin/sh
# Consistent PostgreSQL custom-format backup. It never addresses the legacy stack.
set -eu
database="${1:-${PERSONALHUB_PG_DATABASE:-personalhub}}"
case "$database" in *[!A-Za-z0-9_]*|'') echo "Unsafe database name" >&2; exit 2;; esac
: "${PERSONALHUB_POSTGRES_PASSWORD:?Load .env.overhaul explicitly}"
mkdir -p backups/postgres
stamp=$(date +%Y%m%d-%H%M%S)
tmp=$(mktemp "backups/postgres/${database}-${stamp}-XXXXXX.dump.partial")
file=${tmp%.partial}
trap 'rm -f "$tmp"' EXIT HUP INT TERM
docker compose --env-file .env.overhaul -f docker-compose.overhaul.yml exec -T postgres \
  pg_dump -U personalhub --format=custom --no-owner --no-privileges --dbname="$database" > "$tmp"
test -s "$tmp"
# A readable table-of-contents proves this is a PostgreSQL custom archive before publishing it.
docker compose --env-file .env.overhaul -f docker-compose.overhaul.yml exec -T postgres pg_restore -l < "$tmp" >/dev/null
mv "$tmp" "$file"
trap - EXIT HUP INT TERM
echo "Created verified PostgreSQL backup: $file"
