#!/bin/bash
# ============================================================
# BagajPark - Ic is ucu cagirici (ortak sarmalayici)
# ============================================================
# /api/internal/* uclarini CRON_SECRET ile tetikler ve sonucu ACIKCA loglar.
#
# NEDEN ORTAK: her is icin ayri bir script yazmak, ayni 60 satirin kopyalanmasi
# demekti. Odeme mutabakat cron'u tam bu yuzden 2 ay boyunca 404 alip kimseye
# haber vermedi -- kopyalardan biri hatayi yutuyordu. Tek yer, tek davranis.
#
# SIR CRONTAB'A YAZILMAZ: CRON_SECRET calisma aninda .env'den okunur. Crontab
# dosyasina gomulen bir token, `crontab -l` calistiran herkese gorunur olur.
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_APP_DIR="/root/emanetci"
readonly DEFAULT_BASE_URL="https://bagajpark.com"

function log() {
  >&2 echo -e "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"
}

function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME --job <ad> [SECENEKLER]"
  echo
  echo "Bir /api/internal/<ad> ucunu CRON_SECRET ile POST eder."
  echo
  echo "Secenekler:"
  echo -e "  --job\t\tIc is adi (uc yolu: /api/internal/<ad>). ZORUNLU."
  echo -e "  --base-url\tUygulama adresi. Varsayilan: $DEFAULT_BASE_URL"
  echo -e "  --app-dir\t.env dosyasinin bulundugu dizin. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --timeout\tcurl azami sure (saniye). Varsayilan: 120"
  echo -e "  --help\t\tBu metni gosterir"
  echo
  echo "Ornek:"
  echo "  $SCRIPT_NAME --job overdue-scan"
  echo "  $SCRIPT_NAME --job generate-slots --base-url https://staging.bagajpark.com"
  echo
}

function assert_not_empty() {
  local -r arg_name="$1"
  local -r arg_value="$2"
  if [[ -z "$arg_value" ]]; then
    log_error "'$arg_name' bos olamaz"
    print_usage
    exit 1
  fi
}

function assert_is_installed() {
  local -r name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    log_error "'$name' kurulu degil, gerekli"
    exit 1
  fi
}

# Degeri stdout'a HIC basmaz; yalnizca stdout uzerinden cagirana dondurur ki
# `local readonly x=$(read_cron_secret)` seklinde alinabilsin.
function read_cron_secret() {
  local -r env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    log_error "$env_file bulunamadi"
    return 1
  fi
  local secret
  secret=$(grep -m1 '^CRON_SECRET=' "$env_file" | cut -d= -f2- | tr -d '"'"'"'[:space:]')
  if [[ -z "$secret" ]]; then
    log_error "CRON_SECRET $env_file icinde tanimli degil veya bos"
    return 1
  fi
  echo "$secret"
}

function main() {
  local job=""
  local base_url="$DEFAULT_BASE_URL"
  local app_dir="$DEFAULT_APP_DIR"
  local timeout="120"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --job)      job="$2";      shift 2 ;;
      --base-url) base_url="$2"; shift 2 ;;
      --app-dir)  app_dir="$2";  shift 2 ;;
      --timeout)  timeout="$2";  shift 2 ;;
      --help)     print_usage; exit 0 ;;
      *)
        log_error "Bilinmeyen secenek: $1"
        print_usage
        exit 1
        ;;
    esac
  done

  assert_not_empty "--job" "$job"
  assert_is_installed "curl"

  local -r env_file="$app_dir/.env"
  local secret
  # Ayri satirda atama: `local x=$(...)` cikis kodunu maskeler.
  secret=$(read_cron_secret "$env_file")

  local -r endpoint="$base_url/api/internal/$job"
  log_info "$job tetikleniyor -> $endpoint"

  # --fail KULLANILMIYOR: -sf, 404/401'de sessizce cikar ve hicbir sey loglamaz.
  # Odeme mutabakat cron'u tam bu yuzden 2 ay boyunca 404 alip kimseye haber
  # vermedi. Durum kodunu ve govdeyi acikca yaziyoruz.
  local -r body_file=$(mktemp)
  local http_code
  http_code=$(curl -s -o "$body_file" -w '%{http_code}' \
    --max-time "$timeout" \
    -X POST \
    -H "X-Cron-Secret: $secret" \
    "$endpoint" || echo "000")

  local -r body=$(head -c 600 "$body_file")
  rm -f "$body_file"

  if [[ "$http_code" == "200" ]]; then
    log_info "BASARILI (HTTP $http_code): $body"
    return 0
  fi

  log_error "BASARISIZ (HTTP $http_code): $body"
  log_error "  401 -> CRON_SECRET uyusmuyor | 503 -> uygulamada CRON_SECRET tanimsiz"
  log_error "  404 -> uc kaldirilmis (mutabakat cron'unda oldugu gibi) | 000 -> baglanti kurulamadi"
  return 1
}

main "$@"
