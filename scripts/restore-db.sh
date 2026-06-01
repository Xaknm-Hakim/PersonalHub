#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DB_PATH="$ROOT_DIR/data/personalhub.db"
DATA_DIR="$ROOT_DIR/data"
BACKUP_DIR="$ROOT_DIR/backups"

if [ "$#" -ne 1 ]; then
  echo "Usage: ./scripts/restore-db.sh ./backups/personalhub-example.db" >&2
  exit 1
fi

RESTORE_SOURCE="$1"

case "$RESTORE_SOURCE" in
  /*) SOURCE_PATH="$RESTORE_SOURCE" ;;
  *) SOURCE_PATH="$ROOT_DIR/$RESTORE_SOURCE" ;;
esac

if [ ! -f "$SOURCE_PATH" ]; then
  echo "Error: backup file not found at $SOURCE_PATH" >&2
  echo "No restore was performed." >&2
  exit 1
fi

mkdir -p "$DATA_DIR" "$BACKUP_DIR"

echo "WARNING: This will replace the current PersonalHub database:"
echo "  $DB_PATH"
echo "with backup:"
echo "  $SOURCE_PATH"
echo
echo "If a current database exists, a safety backup will be created first."
printf "Type YES to continue: "
read -r CONFIRMATION

if [ "$CONFIRMATION" != "YES" ]; then
  echo "Restore cancelled. No changes were made."
  exit 0
fi

if [ -f "$DB_PATH" ]; then
  TIMESTAMP="$(date +"%Y-%m-%d-%H%M%S")"
  SAFETY_BACKUP="$BACKUP_DIR/personalhub-pre-restore-$TIMESTAMP.db"
  cp "$DB_PATH" "$SAFETY_BACKUP"
  echo "Safety backup created: $SAFETY_BACKUP"
fi

cp "$SOURCE_PATH" "$DB_PATH"

echo "Database restored from: $SOURCE_PATH"
echo "Restored database path: $DB_PATH"
