#!/bin/sh
# One-off: tighten objects already written under var/objects.
# New uploads set these modes themselves. Run once on the droplet after deploy:
#   cd /opt/lookuvi && ./scripts/chmod-objects.sh
# If the files live in the app container, run it there:
#   docker compose --env-file .env.production -f docker-compose.prod.yml exec app ./scripts/chmod-objects.sh
set -eu
ROOT="${1:-var/objects}"
if [ ! -d "$ROOT" ]; then
  echo "No $ROOT directory. Nothing to change."
  exit 0
fi
find "$ROOT" -type d -exec chmod 0750 {} +
find "$ROOT" -type f -exec chmod 0640 {} +
echo "Updated $ROOT (directories 0750, files 0640)."
