#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DB_PATH="$ROOT_DIR/data/personalhub.db"
BACKUP_DIR="$ROOT_DIR/backups"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: database not found at $DB_PATH" >&2
  echo "No backup was created." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y-%m-%d-%H%M%S")"
BACKUP_PATH="$BACKUP_DIR/personalhub-$TIMESTAMP.db"

cp "$DB_PATH" "$BACKUP_PATH"

echo "Backup created: $BACKUP_PATH"
