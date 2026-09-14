#!/bin/sh
# Create a local PostgreSQL environment file once, without displaying credentials.
set -eu

file=.env.overhaul
if [ -e "$file" ]; then
  echo "$file already exists; refusing to overwrite it." >&2
  exit 1
fi

password=$(openssl rand -hex 32)
umask 077
set -C
if ! { printf '%s\n' "PERSONALHUB_POSTGRES_PASSWORD=$password"; printf '%s\n' "PERSONALHUB_DATABASE_URL=postgresql://personalhub:$password@127.0.0.1:5433/personalhub?schema=public"; } > "$file"; then
  echo "Could not create $file exclusively." >&2
  exit 1
fi
set +C

echo "Created $file with owner-only permissions."
