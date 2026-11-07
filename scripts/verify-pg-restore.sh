#!/bin/sh
# Restore a dump into a throwaway database and compare table counts with production.
# Does not replace the live database.
#
# Usage, on the droplet:
#   cd /opt/lookuvi && ./scripts/verify-pg-restore.sh /opt/lookuvi/backups/lookuvi-YYYYMMDDTHHMMSSZ.dump
#
# Uses docker compose --env-file. .env.production is not shell-sourced.
set -eu
cd "$(dirname "$0")/.."
DUMP="${1:-}"
ENV_FILE="${ENV_FILE:-.env.production}"
RESTORE_DB="${RESTORE_DB:-lookuvi_restore}"
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

case "$RESTORE_DB" in
  *[!A-Za-z0-9_]*) echo "RESTORE_DB must be letters, numbers, and underscores." >&2; exit 1 ;;
esac

compose cp "$DUMP" db:/tmp/lookuvi-verify.dump
compose exec -T db sh -s <<EOF
set -eu
psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d postgres -c 'DROP DATABASE IF EXISTS "$RESTORE_DB";'
psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d postgres -c 'CREATE DATABASE "$RESTORE_DB";'
pg_restore --no-owner --exit-on-error -U "\$POSTGRES_USER" -d "$RESTORE_DB" /tmp/lookuvi-verify.dump
src=\$(psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
rst=\$(psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "$RESTORE_DB" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
echo "tables source=\$src restored=\$rst"
test "\$src" = "\$rst"
psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d postgres -c 'DROP DATABASE IF EXISTS "$RESTORE_DB";'
rm -f /tmp/lookuvi-verify.dump
EOF
echo "restore ok"
