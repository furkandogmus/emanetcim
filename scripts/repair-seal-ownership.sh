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

# 2026-08-29: bu script bu sunucuda HIC calismiyordu. Iki sebep vardi ve
# ikincisi birincisi duzeltilmeden gorunmuyordu:
#   1. `psql` HOST'ta kurulu degil -> assert_is_installed ilk adimda duserdi.
#   2. .env icindeki DATABASE_URL `emanetci` veritabanini gosteriyor, o ise YOK
#      (yalnizca `postgres` ve `bagajpark` var). Ikisi de Hetzner doneminden.
# Sorgular artik konteyner icindeki psql ile, compose'un kendi baglantisiyla
# kosuyor; host'ta psql aranmiyor ve olu DATABASE_URL'e guvenilmiyor.
set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_APP_DIR="/opt/emanetci"

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

function psql_run() {
  local -r app_dir="$1"; shift
  docker compose --project-directory "$app_dir" --env-file "$app_dir/docker-compose.env" \
    exec -T postgres psql -U bagajpark -d bagajpark -v ON_ERROR_STOP=1 "$@"
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

  assert_is_installed "docker"

  log_info "Mevcut durum okunuyor (salt okunur)..."
  psql_run "$app_dir" -c "
    SELECT status,
           COUNT(*) FILTER (WHERE \"shopId\" IS NULL)     AS sahipsiz,
           COUNT(*) FILTER (WHERE \"shopId\" IS NOT NULL) AS sahipli,
           COUNT(*)                                        AS toplam
    FROM \"Seal\" GROUP BY status ORDER BY status;"

  local affected
  affected=$(psql_run "$app_dir" -t -A -c "
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
    psql_run "$app_dir" -c "
      UPDATE \"Seal\"
      SET status = 'STOCK', \"assignedAt\" = NULL
      WHERE status <> 'STOCK' AND \"shopId\" IS NULL;"
    log_info "Onarim tamamlandi."
  fi

  if [[ "$validate" == "true" ]]; then
    log_info "DB kisiti dogrulaniyor..."
    # NOT VALID olarak eklenmisti; buradan sonra mevcut satirlar da kontrol edilir.
    psql_run "$app_dir" -c "
      ALTER TABLE \"Seal\" VALIDATE CONSTRAINT \"Seal_ownership_matches_status\";"
    log_info "Kisit dogrulandi -- bundan sonra gecersiz satir DB seviyesinde imkansiz."
  fi

  return 0
}

main "$@"
