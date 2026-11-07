#!/bin/sh
# Restore one local dump into the production database. Stop the app first.
# Usage: ./scripts/restore-postgres.sh /opt/lookuvi/backups/lookuvi-YYYYMMDDTHHMMSSZ.dump
#
# Uses docker compose --env-file so .env.production is not shell-sourced.
set -eu
cd "$(dirname "$0")/.."
DUMP="${1:-}"
ENV_FILE="${ENV_FILE:-.env.production}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Pass a dump file, for example /opt/lookuvi/backups/lookuvi-20261107T190000Z.dump" >&2
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml "$@"
}

compose cp "$DUMP" db:/tmp/lookuvi.dump
compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/lookuvi.dump'
compose exec -T db rm -f /tmp/lookuvi.dump
echo "Restored $DUMP"
