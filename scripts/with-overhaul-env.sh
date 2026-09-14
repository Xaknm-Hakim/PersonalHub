#!/bin/sh
# Complete the local overhaul database environment without printing credentials.
set -eu
if [ -z "${PERSONALHUB_DATABASE_URL:-}" ]; then
  : "${PERSONALHUB_POSTGRES_PASSWORD:?Load .env.overhaul explicitly}"
  PERSONALHUB_DATABASE_URL="postgresql://personalhub:${PERSONALHUB_POSTGRES_PASSWORD}@127.0.0.1:5433/personalhub?schema=public"
  export PERSONALHUB_DATABASE_URL
fi
exec "$@"
