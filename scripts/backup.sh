#!/usr/bin/env bash
# PostgreSQL (ve isteğe bağlı public/) yedeği — docker compose ortamı.
#
# Kullanım (repo kökünden veya VM’de /opt/emanetci):
#   ./scripts/backup.sh
#   ./scripts/backup.sh /opt/emanetci
#
# Ortam:
#   BACKUP_DIR=/var/backups/emanetci   Yedek dizini (varsayılan: <ROOT>/backups)
#   INCLUDE_PUBLIC=1                   public/ klasörünü de tar.gz ile ekle
#   COMPOSE_ENV=docker-compose.env     --env-file adı

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}}"
COMPOSE_ENV="${COMPOSE_ENV:-docker-compose.env}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
NAME="emanetci_${STAMP}"

cd "$ROOT" || {
  echo "backup: dizin açılamadı: $ROOT" >&2
  exit 1
}

if [[ ! -f docker-compose.yml ]]; then
  echo "backup: $ROOT içinde docker-compose.yml yok." >&2
  exit 1
fi

compose() {
  if [[ -f "$COMPOSE_ENV" ]]; then
    docker compose --env-file "$COMPOSE_ENV" "$@"
  else
    docker compose "$@"
  fi
}

mkdir -p "$BACKUP_DIR"

echo "==> postgres: $NAME.dump (konteyner içi POSTGRES_USER / POSTGRES_DB ile)"
compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' \
  >"$BACKUP_DIR/${NAME}.dump"

echo "==> boyut: $(du -h "$BACKUP_DIR/${NAME}.dump" | cut -f1)"

if [[ "${INCLUDE_PUBLIC:-0}" == "1" ]] && [[ -d "$ROOT/public" ]]; then
  echo "==> public/: ${NAME}_public.tar.gz"
  tar -czf "$BACKUP_DIR/${NAME}_public.tar.gz" -C "$ROOT/public" .
  echo "==> boyut: $(du -h "$BACKUP_DIR/${NAME}_public.tar.gz" | cut -f1)"
fi

echo "==> tamam: $BACKUP_DIR/${NAME}.dump"
echo "==> geri yükleme: FORCE=1 $ROOT/scripts/restore.sh $BACKUP_DIR/${NAME}.dump"
