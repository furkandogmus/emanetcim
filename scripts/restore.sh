#!/usr/bin/env bash
# PostgreSQL yedeğini geri yükler (pg_restore). web servisi kısa süre durur.
#
# Kullanım:
#   ./scripts/restore.sh /path/to/emanetci_YYYYMMDD_HHMMSS.dump
#   FORCE=1 ./scripts/restore.sh ./backups/emanetci_xxx.dump   # onay sorma
#
# Ortam:
#   ROOT=/opt/emanetci          Repo kökü (varsayılan: script’in üst dizini)
#   COMPOSE_ENV=docker-compose.env
#
# Uyarı: Mevcut emanetci veritabanındaki nesneler --clean ile silinir; sonra yedek içeriği yüklenir.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
COMPOSE_ENV="${COMPOSE_ENV:-docker-compose.env}"

if [[ $# -lt 1 ]] || [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  echo "Kullanım: $0 <yedek.dump>   (pg_dump -Fc ile alınmış dosya)" >&2
  exit 1
fi

BACKUP_ARG="$1"

cd "$ROOT" || {
  echo "restore: dizin açılamadı: $ROOT" >&2
  exit 1
}

if [[ ! -f docker-compose.yml ]]; then
  echo "restore: $ROOT içinde docker-compose.yml yok." >&2
  exit 1
fi

if [[ ! -f "$BACKUP_ARG" ]]; then
  echo "restore: dosya yok: $BACKUP_ARG" >&2
  exit 1
fi

# Mutlak yol (bash)
if [[ "$BACKUP_ARG" != /* ]]; then
  BACKUP_FILE="$(cd "$(dirname "$BACKUP_ARG")" && pwd)/$(basename "$BACKUP_ARG")"
else
  BACKUP_FILE="$BACKUP_ARG"
fi

compose() {
  if [[ -f "$COMPOSE_ENV" ]]; then
    docker compose --env-file "$COMPOSE_ENV" "$@"
  else
    docker compose "$@"
  fi
}

if [[ "${FORCE:-0}" != "1" ]]; then
  echo "DİKKAT: Bu işlem mevcut 'emanetci' veritabanını yedekteki içerikle değiştirir."
  echo "Yedek: $BACKUP_FILE"
  read -r -p "Devam etmek istiyor musunuz? [y/N] " reply
  if [[ ! "${reply:-}" =~ ^[yY]$ ]]; then
    echo "İptal."
    exit 0
  fi
fi

echo "==> postgres çalışıyor mu kontrol"
compose up -d postgres
compose exec postgres pg_isready -U emanetci -d emanetci

echo "==> web durduruluyor (bağlantı çakışmasını önlemek için)"
compose stop web || true

echo "==> pg_restore (stdin)"
cat "$BACKUP_FILE" | compose exec -T postgres pg_restore \
  -U emanetci \
  -d emanetci \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --verbose \
  -

echo "==> web başlatılıyor"
compose up -d web

echo "==> bitti. Kontrol: curl -s http://127.0.0.1/api/health/live"
