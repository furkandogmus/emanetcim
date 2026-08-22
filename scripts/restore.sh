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
  echo "DİKKAT: Bu işlem mevcut Postgres veritabanını (compose POSTGRES_DB) yedekteki içerikle değiştirir."
  echo "Yedek: $BACKUP_FILE"
  read -r -p "Devam etmek istiyor musunuz? [y/N] " reply
  if [[ ! "${reply:-}" =~ ^[yY]$ ]]; then
    echo "İptal."
    exit 0
  fi
fi

echo "==> postgres çalışıyor mu kontrol"
compose up -d postgres
compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "==> web durduruluyor (bağlantı çakışmasını önlemek için)"
compose stop web || true

# Dosya konteynere KOPYALANIR, stdin kullanılmaz. Eski hâli `cat | exec -T ... -` idi:
# SSH üzerinden (tty/stdin yokken) pg_restore "-" dosyasını bulamıyordu ve web durmuş
# kalıyordu — 2026-08-22 Hetzner→AWS kesiminde canlıda yaşandı.
echo "==> pg_restore (konteyner içi kopya)"
compose cp "$BACKUP_FILE" postgres:/tmp/restore.dump
compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl /tmp/restore.dump; rc=$?; rm -f /tmp/restore.dump; exit $rc' \
  || echo "restore: pg_restore uyarı/hata verdi (extension gibi önemsiz olabilir), tablo sayılarını kontrol edin" >&2

echo "==> web başlatılıyor"
compose up -d web

echo "==> bitti. Kontrol: curl -s http://127.0.0.1/api/health/live"
