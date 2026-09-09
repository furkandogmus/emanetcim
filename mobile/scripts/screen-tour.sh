#!/bin/bash
# Gercek cihazda ekran turu: integration_test/screen_tour_test.dart'i flutter drive ile
# kosar, uc rolle giris yapip her rotanin ekran goruntusunu build/screenshots/tour/ altina
# yazar. Cihaz/API adresi mobile/.device.env'den; sifre ve test id'leri yerel backend'in
# seed verisinden (prisma/seed.ts + docker postgres). Canli API'ye ASLA baglanmaz.

set -e

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly REPO_DIR="$(cd "$MOBILE_DIR/.." && pwd)"
readonly ENV_FILE="${MOBILE_DIR}/.device.env"
readonly LOG_DIR="${SCRIPT_DIR}/logs"
readonly TOUR_DIR="${MOBILE_DIR}/build/screenshots/tour"
readonly ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
readonly ADB="${ANDROID_HOME}/platform-tools/adb"
readonly DB_CONTAINER="${DB_CONTAINER:-emanetcim-postgres-1}"
readonly APP_ID="com.bagajpark"
readonly LOG_FILE="${LOG_DIR}/screen-tour-$(date -u +"%Y%m%dT%H%M%SZ").log"

function log {
  local readonly level="$1"
  local readonly message="$2"
  local readonly timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  local readonly line="${timestamp} [${level}] [$SCRIPT_NAME] ${message}"
  >&2 echo -e "$line"
  echo -e "$line" >> "$LOG_FILE"
}

function log_info {
  local readonly message="$1"
  log "INFO" "$message"
}

function log_warn {
  local readonly message="$1"
  log "WARN" "$message"
}

function log_error {
  local readonly message="$1"
  log "ERROR" "$message"
}

function print_usage {
  echo
  echo "Usage: $SCRIPT_NAME [OPTIONS]"
  echo
  echo "Gercek cihazda ekran turu; ciktilar build/screenshots/tour/<sira>_<rol>_<rota>.png."
  echo "On kosul: yerel backend ayakta (npm run dev), seed verisi yuklu, cihaz kablosuz adb'de."
  echo
  echo "Options:"
  echo
  echo -e "  --roles <liste>\tVirgullu rol listesi (varsayilan: guest,partner,admin)."
  echo -e "  --device <id>\t\t.device.env'deki ADB_DEVICE yerine."
  echo -e "  --api <url>\t\t.device.env'deki API_BASE_URL yerine."
  echo -e "  --password <p>\tDemo sifre; yoksa E2E_PASSWORD env, o da yoksa prisma/seed.ts'ten okunur."
  echo -e "  --shop-id <id>\tShop id; yoksa docker postgres'ten ilk dukkan."
  echo -e "  --guest-booking <id>\tMisafir rezervasyon id; yoksa DB'den."
  echo -e "  --partner-booking <id>\tEsnaf rezervasyon id; yoksa DB'den."
  echo -e "  --help\t\tBu metin."
  echo
  echo "Example:"
  echo
  echo "  $SCRIPT_NAME"
  echo "  $SCRIPT_NAME --roles guest"
}

function assert_not_empty {
  local readonly arg_name="$1"
  local readonly arg_value="$2"

  if [[ -z "$arg_value" ]]; then
    log_error "'$arg_name' bos olamaz"
    print_usage
    exit 1
  fi
}

function assert_is_installed {
  local readonly name="$1"

  if [[ ! $(command -v "$name") ]]; then
    log_error "'$name' bulunamadi, kurulu olmali"
    exit 1
  fi
}

function assert_local_api {
  local readonly url="$1"
  if printf '%s' "$url" | grep -qiE 'bagajpark\.com'; then
    log_error "API_BASE_URL canli ortami gosteriyor ($url). Ekran turu yalnizca yerel backend'e karsi kosar."
    exit 1
  fi
}

# Seed dosyasindaki demo sifre (ekrana basilmaz).
function read_seed_password {
  grep -A4 "const demoPassword" "${REPO_DIR}/prisma/seed.ts" \
    | grep -oE ": '[^']+'" | head -1 | sed -E "s/^: '//; s/'$//"
}

function db_query {
  local readonly sql="$1"
  docker exec "$DB_CONTAINER" sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$sql\"" 2>/dev/null | head -1
}

function grant_permissions {
  local readonly a="$1"
  # Sistem izin diyaloglari turu kilitler (adb input Xiaomi'de calismaz); onceden ver.
  local perm
  for perm in CAMERA ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS; do
    $a shell pm grant "$APP_ID" "android.permission.$perm" >/dev/null 2>&1 || log_warn "izin verilemedi: $perm"
  done
}

function run_tour {
  local readonly device="$1"
  local readonly api="$2"
  local readonly password="$3"
  local readonly roles="$4"
  local readonly shop_id="$5"
  local readonly guest_booking="$6"
  local readonly partner_booking="$7"

  cd "$MOBILE_DIR"
  mkdir -p "$TOUR_DIR"
  log_info "flutter drive (cihaz=$device, api=$api, roller=$roles, shop=$shop_id)"
  log_info "cikti: $TOUR_DIR ; log: $LOG_FILE"
  # Sifre komut satirinda gorunmesin diye log'a yazilmaz; flutter drive ciktisi log'a eklenir.
  flutter drive \
    -d "$device" \
    --driver=test_driver/integration_test.dart \
    --target=integration_test/screen_tour_test.dart \
    --dart-define=API_BASE_URL="$api" \
    --dart-define=FIREBASE_ENABLED=false \
    --dart-define=E2E_CAPTURE=true \
    --dart-define=E2E_PASSWORD="$password" \
    --dart-define=E2E_ROLES="$roles" \
    --dart-define=E2E_SHOP_ID="$shop_id" \
    --dart-define=E2E_GUEST_BOOKING_ID="$guest_booking" \
    --dart-define=E2E_PARTNER_BOOKING_ID="$partner_booking" \
    2>&1 | sed -E "s/${password}/***/g" | tee -a "$LOG_FILE" >&2
  local readonly status=${PIPESTATUS[0]}
  if [[ "$status" -ne 0 ]]; then
    log_error "flutter drive basarisiz (cikis $status); log: $LOG_FILE"
    return 1
  fi
  log_info "tamamlandi: $(ls "$TOUR_DIR" | wc -l | tr -d ' ') ekran goruntusu -> $TOUR_DIR"
  log_info "simdi her PNG'yi ac ve GERCEKTEN BAK; 'EKRAN TURU OZETI' satirini log'da kontrol et"
}

function main {
  local device=""
  local api=""
  local password="${E2E_PASSWORD:-}"
  local roles="guest,partner,admin"
  local shop_id=""
  local guest_booking=""
  local partner_booking=""

  mkdir -p "$LOG_DIR"

  if [[ -f "$ENV_FILE" ]]; then
    device=$(grep -E '^ADB_DEVICE=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true)
    api=$(grep -E '^API_BASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true)
  fi

  while [[ $# > 0 ]]; do
    local key="$1"

    case "$key" in
      --roles)
        roles="$2"
        shift
        ;;
      --device)
        device="$2"
        shift
        ;;
      --api)
        api="$2"
        shift
        ;;
      --password)
        password="$2"
        shift
        ;;
      --shop-id)
        shop_id="$2"
        shift
        ;;
      --guest-booking)
        guest_booking="$2"
        shift
        ;;
      --partner-booking)
        partner_booking="$2"
        shift
        ;;
      --help)
        print_usage
        exit
        ;;
      *)
        log_error "Bilinmeyen arguman: $key"
        print_usage
        exit 1
        ;;
    esac

    shift
  done

  assert_is_installed flutter
  assert_is_installed docker
  assert_not_empty "ADB_DEVICE" "$device"
  assert_not_empty "API_BASE_URL" "$api"
  assert_local_api "$api"

  if [[ -z "$password" ]]; then
    password=$(read_seed_password)
  fi
  assert_not_empty "E2E_PASSWORD" "$password"

  if [[ -z "$shop_id" ]]; then
    shop_id=$(db_query "select id from \\\"Shop\\\" order by \\\"createdAt\\\" limit 1")
  fi
  if [[ -z "$guest_booking" ]]; then
    guest_booking=$(db_query "select b.id from \\\"Booking\\\" b join \\\"User\\\" u on u.id=b.\\\"guestId\\\" where u.email='misafir@test.com' order by b.\\\"createdAt\\\" desc limit 1")
  fi
  if [[ -z "$partner_booking" ]]; then
    partner_booking=$(db_query "select b.id from \\\"Booking\\\" b join \\\"Shop\\\" s on s.id=b.\\\"shopId\\\" join \\\"User\\\" u on u.id=s.\\\"ownerId\\\" where u.email='esnaf@test.com' order by b.\\\"createdAt\\\" desc limit 1")
  fi
  [[ -z "$shop_id" ]] && log_warn "shop id bulunamadi; /shop ve /checkout rotalari atlanacak"
  [[ -z "$guest_booking" ]] && log_warn "misafir rezervasyonu bulunamadi; /booking/:id atlanacak"
  [[ -z "$partner_booking" ]] && log_warn "esnaf rezervasyonu bulunamadi; /partner/booking/:id atlanacak"

  if ! "$ADB" -s "$device" get-state >/dev/null 2>&1; then
    log_error "cihaz hazir degil ($device); scripts/device.sh --connect dene"
    exit 1
  fi
  grant_permissions "$ADB -s $device"

  run_tour "$device" "$api" "$password" "$roles" "$shop_id" "$guest_booking" "$partner_booking"
}

main "$@"
