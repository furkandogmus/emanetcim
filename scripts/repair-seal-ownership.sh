#!/bin/bash
# ============================================================
# BagajPark - Muhur sahiplik onarimi
# ============================================================
# `STOCK` disinda olup hicbir dukkana ait olmayan muhurleri `STOCK`'a geri alir.
#
# NEDEN: 2026-08-22 denetiminde 1.277 muhrun 1.247'si `ASSIGNED` ama `shopId` NULL
# idi. `ASSIGNED` + sahipsiz bir muhur ANLAMSIZ bir durumdur: hicbir dukkana
# atanmamis bir muhur "atanmis" olamaz, o yuzden `STOCK`'a donmesi bilgi kaybi
# degil, bilginin duzeltilmesidir.
#
# VARSAYILAN KURU CALISMADIR. Hicbir sey degistirmez, yalnizca ne yapacagini
# soyler. Gercekten degistirmek icin `--apply` gerekir.
#
# Ayrinti: docs/DEFECT_BACKLOG.md -> P1-7, scripts/README.md
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_APP_DIR="/root/emanetci"

function log() {
  >&2 echo -e "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"
}

function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME [SECENEKLER]"
  echo
  echo "STOCK disinda olup hicbir dukkana ait olmayan muhurleri STOCK'a geri alir."
  echo "VARSAYILAN KURU CALISMADIR -- degistirmek icin --apply gerekir."
  echo
  echo "Secenekler:"
  echo -e "  --apply\t\tGERCEKTEN degistir. Bu bayrak olmadan hicbir sey yazilmaz."
  echo -e "  --validate\tOnarimdan sonra DB kisitini VALIDATE eder (--apply gerektirir)."
  echo -e "  --app-dir\t.env dosyasinin bulundugu dizin. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --help\t\tBu metni gosterir"
  echo
  echo "Ornek:"
  echo "  $SCRIPT_NAME                      # ne yapacagini gosterir, dokunmaz"
  echo "  $SCRIPT_NAME --apply --validate   # onarir ve kisiti dogrular"
  echo
}

function assert_is_installed() {
  local -r name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    log_error "'$name' kurulu degil, gerekli"
    exit 1
  fi
}

function read_database_url() {
  local -r env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    log_error "$env_file bulunamadi"
    return 1
  fi
  local url
  url=$(grep -m1 '^DATABASE_URL=' "$env_file" | cut -d= -f2- | tr -d '"'"'"'')
  if [[ -z "$url" ]]; then
    log_error "DATABASE_URL $env_file icinde tanimli degil veya bos"
    return 1
  fi
  echo "$url"
}

function main() {
  local apply="false"
  local validate="false"
  local app_dir="$DEFAULT_APP_DIR"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --apply)    apply="true";    shift ;;
      --validate) validate="true"; shift ;;
      --app-dir)  app_dir="$2";    shift 2 ;;
      --help)     print_usage; exit 0 ;;
      *)
        log_error "Bilinmeyen secenek: $1"
        print_usage
        exit 1
        ;;
    esac
  done

  if [[ "$validate" == "true" && "$apply" != "true" ]]; then
    log_error "--validate, --apply olmadan kullanilamaz"
    exit 1
  fi

  assert_is_installed "psql"

  local db_url
  db_url=$(read_database_url "$app_dir/.env")

  log_info "Mevcut durum okunuyor (salt okunur)..."
  psql "$db_url" -v ON_ERROR_STOP=1 -c "
    SELECT status,
           COUNT(*) FILTER (WHERE \"shopId\" IS NULL)     AS sahipsiz,
           COUNT(*) FILTER (WHERE \"shopId\" IS NOT NULL) AS sahipli,
           COUNT(*)                                        AS toplam
    FROM \"Seal\" GROUP BY status ORDER BY status;"

  local affected
  affected=$(psql "$db_url" -t -A -v ON_ERROR_STOP=1 -c "
    SELECT COUNT(*) FROM \"Seal\" WHERE status <> 'STOCK' AND \"shopId\" IS NULL;")

  log_info "Onarilacak satir sayisi: $affected"

  if [[ "$affected" == "0" ]]; then
    log_info "Onarilacak bir sey yok."
  elif [[ "$apply" != "true" ]]; then
    log_warn "KURU CALISMA -- hicbir sey degistirilmedi."
    log_warn "Gercekten onarmak icin: $SCRIPT_NAME --apply"
    return 0
  else
    log_info "Onariliyor ($affected satir -> STOCK)..."
    psql "$db_url" -v ON_ERROR_STOP=1 -c "
      UPDATE \"Seal\"
      SET status = 'STOCK', \"assignedAt\" = NULL
      WHERE status <> 'STOCK' AND \"shopId\" IS NULL;"
    log_info "Onarim tamamlandi."
  fi

  if [[ "$validate" == "true" ]]; then
    log_info "DB kisiti dogrulaniyor..."
    # NOT VALID olarak eklenmisti; buradan sonra mevcut satirlar da kontrol edilir.
    psql "$db_url" -v ON_ERROR_STOP=1 -c "
      ALTER TABLE \"Seal\" VALIDATE CONSTRAINT \"Seal_ownership_matches_status\";"
    log_info "Kisit dogrulandi -- bundan sonra gecersiz satir DB seviyesinde imkansiz."
  fi

  return 0
}

main "$@"
