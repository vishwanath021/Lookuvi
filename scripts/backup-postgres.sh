#!/bin/sh
# Daily Postgres dump for the production compose stack.
# Run from the droplet: cd /opt/lookuvi && ./scripts/backup-postgres.sh
#
# Reads .env.production with Docker's --env-file. Do not shell-source that file.
# Values can contain spaces and quotes that a shell dot-include would split.
# The database container runs pg_dump. Dumps stay on the host for 14 days.
set -eu
cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/opt/lookuvi/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"
}

mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/lookuvi-${STAMP}.dump"
compose exec -T db sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$FILE"
chmod 640 "$FILE"

# GNU find: -mtime +14 is strictly older than 14 days.
find "$BACKUP_DIR" -name 'lookuvi-*.dump' -type f -mtime +"$KEEP_DAYS" -delete
echo "Backup file: $FILE"
