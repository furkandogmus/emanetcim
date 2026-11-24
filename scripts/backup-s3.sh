#!/bin/bash
# Postgres yedegini alir (backup.sh) ve son dump'i S3'e kopyalar.
#
# NEDEN: Hetzner'de yedekler yalnizca sunucunun kendi diskindeydi -- sunucu
# giderse yedek de gider. AWS'te instance rolu `s3:PutObject` ile
# `bagajpark-backups-*/backups/` onekine yazar; statik anahtar yok.
#
# SIFRELEME: `BACKUP_AGE_RECIPIENT` (age genel anahtari, `age1...`) ortamda ya da
# <app-dir>/docker-compose.env icinde (SSM'den uretilir) tanimliysa dump S3'e
# `age -r` ile sifrelenip `.dump.age` olarak gider. Sifreleme basarisizsa YUKLEME
# YAPILMAZ. Alici tanimsizsa da yuklenmez: duz yukleme yalniz bilincli
# `BACKUP_ALLOW_PLAINTEXT=1` ile (alici sonradan silinirse sessizce duz metne
# dusulmesin). Basaridan sonra /api/internal/backup-heartbeat cagrilir;
# /api/health/jobs duran yedegi `stale` gosterir. Ozel anahtar sunucuda TUTULMAZ;
# geri yukleme ops/README.md § Yedek ve geri yukleme.
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

# Ortam > docker-compose.env. Dosya `source` edilmez: yalniz o anahtarin satiri okunur.
function read_setting() {
  local -r key="$1" app_dir="$2"
  local -r from_env="${!key:-}"
  if [ -n "$from_env" ]; then
    echo "$from_env"; return
  fi
  local -r env_file="$app_dir/docker-compose.env"
  if [ -r "$env_file" ]; then
    grep -E "^${key}=" "$env_file" | tail -1 | cut -d= -f2- | tr -d '"' || true
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

  local recipient upload="$latest" encrypted="false"
  recipient=$(read_setting BACKUP_AGE_RECIPIENT "$app_dir")
  if [ -n "$recipient" ]; then
    if ! command -v age >/dev/null 2>&1; then
      log_error "BACKUP_AGE_RECIPIENT tanimli ama 'age' kurulu degil -- YUKLENMEDI."; exit 1
    fi
    upload="$latest.age"
    if ! age -r "$recipient" -o "$upload" "$latest"; then
      rm -f "$upload"
      log_error "age sifrelemesi basarisiz -- YUKLENMEDI."; exit 1
    fi
    encrypted="true"
  elif [ "$(read_setting BACKUP_ALLOW_PLAINTEXT "$app_dir")" = "1" ]; then
    log_warn "!!! BACKUP_ALLOW_PLAINTEXT=1: yedek S3'e SIFRESIZ gidiyor (yalniz SSE-S3). !!!"
  else
    log_error "BACKUP_AGE_RECIPIENT tanimsiz ve BACKUP_ALLOW_PLAINTEXT=1 degil -- YUKLENMEDI. ops/README.md § Yedek."
    exit 1
  fi

  log_info "S3'e kopyalaniyor: s3://$bucket/$prefix/$(basename "$upload")"
  if ! aws s3 cp "$upload" "s3://$bucket/$prefix/$(basename "$upload")" --only-show-errors; then
    log_error "S3 kopyasi basarisiz -- yerel dump duruyor: $latest"; exit 1
  fi
  # Sifreli kopya yalniz yukleme icindi; yerelde duz dump kalir (restore.sh onu okur).
  if [ "$upload" != "$latest" ]; then rm -f "$upload"; fi

  # Kalp atisi: gelmezse /api/health/jobs `backup-heartbeat` isini stale gosterir.
  if ! "$app_dir/scripts/call-internal-job.sh" --job backup-heartbeat --method POST --app-dir "$app_dir"; then
    log_warn "yedek yuklendi ama kalp atisi yazilamadi (encrypted=$encrypted)"
  fi

  local removed
  removed=$(find "$backup_dir" -name 'emanetci_*.dump' -mtime +"$keep_days" -print -delete | wc -l | tr -d ' ')
  log_info "tamam. yerelde $keep_days gunden eski $removed dump silindi."
}

main "$@"
