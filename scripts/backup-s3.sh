#!/bin/bash
# Postgres yedegini alir (backup.sh) ve son dump'i S3'e kopyalar.
#
# NEDEN: Hetzner'de yedekler yalnizca sunucunun kendi diskindeydi -- sunucu
# giderse yedek de gider. AWS'te instance rolu `s3:PutObject` ile
# `bagajpark-backups-*/backups/` onekine yazar; statik anahtar yok.
set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_APP_DIR="/opt/emanetci"
readonly DEFAULT_PREFIX="backups"
readonly DEFAULT_KEEP_DAYS="14"

function log()       { >&2 echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"; }
function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME --bucket <ad> [SECENEKLER]"
  echo
  echo "backup.sh ile pg_dump alir, dosyayi s3://<bucket>/<prefix>/ altina kopyalar,"
  echo "yerelde <keep-days> gunden eski dump'lari siler."
  echo
  echo "Secenekler:"
  echo -e "  --bucket\tS3 bucket adi. ZORUNLU."
  echo -e "  --prefix\tS3 oneki. Varsayilan: $DEFAULT_PREFIX"
  echo -e "  --app-dir\tdocker-compose.yml dizini. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --keep-days\tYerel saklama (gun). Varsayilan: $DEFAULT_KEEP_DAYS"
  echo -e "  --help\t\tBu yardim."
  echo
}

function assert_not_empty() {
  local -r name="$1"; local -r value="$2"
  if [ -z "$value" ]; then
    log_error "'$name' bos olamaz."; print_usage; exit 1
  fi
}

function assert_is_installed() {
  local -r bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    log_error "'$bin' kurulu degil."; exit 1
  fi
}

function main() {
  local bucket=""
  local prefix="$DEFAULT_PREFIX"
  local app_dir="$DEFAULT_APP_DIR"
  local keep_days="$DEFAULT_KEEP_DAYS"

  while [ $# -gt 0 ]; do
    case "$1" in
      --bucket)    bucket="$2"; shift ;;
      --prefix)    prefix="$2"; shift ;;
      --app-dir)   app_dir="$2"; shift ;;
      --keep-days) keep_days="$2"; shift ;;
      --help)      print_usage; exit 0 ;;
      *) log_error "Bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
    shift
  done

  assert_not_empty "--bucket" "$bucket"
  assert_is_installed "aws"
  assert_is_installed "docker"

  local -r backup_dir="$app_dir/backups"
  log_info "pg_dump aliniyor ($app_dir)"
  if ! BACKUP_DIR="$backup_dir" "$app_dir/scripts/backup.sh" "$app_dir" >/dev/null; then
    log_error "backup.sh basarisiz"; exit 1
  fi

  local latest
  latest=$(ls -t "$backup_dir"/emanetci_*.dump 2>/dev/null | head -1)
  assert_not_empty "son dump" "$latest"

  log_info "S3'e kopyalaniyor: s3://$bucket/$prefix/$(basename "$latest")"
  if ! aws s3 cp "$latest" "s3://$bucket/$prefix/$(basename "$latest")" --only-show-errors; then
    log_error "S3 kopyasi basarisiz -- yerel dump duruyor: $latest"; exit 1
  fi

  local removed
  removed=$(find "$backup_dir" -name 'emanetci_*.dump' -mtime +"$keep_days" -print -delete | wc -l | tr -d ' ')
  log_info "tamam. yerelde $keep_days gunden eski $removed dump silindi."
}

main "$@"
