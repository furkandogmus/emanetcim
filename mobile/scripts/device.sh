#!/bin/bash
# Gercek Android cihazla (kablosuz adb) gunluk isler: baglan, kur, calistir,
# ekran goruntusu, logcat. Cihaz ve API adresini mobile/.device.env'den okur;
# canli API'ye (bagajpark.com) ASLA baglanmaz.

set -e

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ENV_FILE="${MOBILE_DIR}/.device.env"
readonly SHOT_DIR="${MOBILE_DIR}/build/screenshots"
readonly ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
readonly ADB="${ANDROID_HOME}/platform-tools/adb"
readonly APK="${MOBILE_DIR}/build/app/outputs/flutter-apk/app-debug.apk"

function log {
  local readonly level="$1"
  local readonly message="$2"
  local readonly timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  >&2 echo -e "${timestamp} [${level}] [$SCRIPT_NAME] ${message}"
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
  echo "Usage: $SCRIPT_NAME <ACTION> [OPTIONS]"
  echo
  echo "Gercek cihaz yardimcisi. Cihaz/API adresi mobile/.device.env'den gelir"
  echo "(sablon: scripts/device.env.example)."
  echo
  echo "Actions (biri zorunlu):"
  echo
  echo -e "  --status\t\tCihaz baglantisi + ekran durumu (salt okunur)."
  echo -e "  --connect\t\tADB_DEVICE'a 'adb connect' dene."
  echo -e "  --screencap\t\tEkran goruntusu al -> build/screenshots/<UTC>.png (yolu basar)."
  echo -e "  --logcat\t\tSon Flutter/crash satirlarini bas (salt okunur)."
  echo -e "  --install\t\tYerel API ile debug APK derle ve 'adb install -r' ile kur."
  echo -e "  --run\t\t\tYerel API ile 'flutter run' baslat (hot reload icin on planda)."
  echo
  echo "Options:"
  echo
  echo -e "  --device <id>\t\t.device.env'deki ADB_DEVICE yerine."
  echo -e "  --api <url>\t\t.device.env'deki API_BASE_URL yerine (http://<lan-ip>:3000/api/mobile)."
  echo -e "  --out <path>\t\t--screencap cikti dosyasi."
  echo -e "  --help\t\tBu metin."
  echo
  echo "Example:"
  echo
  echo "  $SCRIPT_NAME --screencap"
  echo "  $SCRIPT_NAME --install && $SCRIPT_NAME --screencap"
}

function assert_not_empty {
  local readonly arg_name="$1"
  local readonly arg_value="$2"

  if [[ -z "$arg_value" ]]; then
    log_error "'$arg_name' bos olamaz (mobile/.device.env ya da bayrak)"
    print_usage
    exit 1
  fi
}

function assert_local_api {
  local readonly url="$1"
  if printf '%s' "$url" | grep -qiE 'bagajpark\.com'; then
    log_error "API_BASE_URL canli ortami gosteriyor ($url). Gelistirmede yalnizca yerel backend."
    exit 1
  fi
}

function adb_target {
  local readonly device="$1"
  if [[ -n "$device" ]]; then
    echo "$ADB -s $device"
  else
    echo "$ADB"
  fi
}

function do_status {
  local readonly device="$1"
  log_info "adb devices:"
  "$ADB" devices | sed '1d' | sed '/^$/d' >&2
  local readonly a=$(adb_target "$device")
  if $a get-state >/dev/null 2>&1; then
    local readonly awake=$($a shell dumpsys power 2>/dev/null | grep -m1 -oE 'mWakefulness=[A-Za-z]+' || true)
    log_info "cihaz hazir (${device:-varsayilan}); ${awake:-wakefulness bilinmiyor}"
    log_info "not: ekran uykudaysa screencap kararir; Xiaomi'de programatik uyandirma yok, elle ac"
  else
    log_warn "cihaz hazir degil; --connect dene ya da telefonda kablosuz hata ayiklamayi yenile"
    return 1
  fi
}

function do_connect {
  local readonly device="$1"
  assert_not_empty "ADB_DEVICE" "$device"
  log_info "adb connect $device"
  local readonly out=$("$ADB" connect "$device" 2>&1)
  log_info "$out"
  if printf '%s' "$out" | grep -qiE 'connected'; then
    return 0
  fi
  log_error "baglanamadi; telefonda Gelistirici secenekleri > Kablosuz hata ayiklama'dan yeni portu al"
  return 1
}

function do_screencap {
  local readonly device="$1"
  local out="$2"
  local readonly a=$(adb_target "$device")
  if [[ -z "$out" ]]; then
    mkdir -p "$SHOT_DIR"
    out="${SHOT_DIR}/$(date -u +"%Y%m%dT%H%M%SZ").png"
  fi
  $a exec-out screencap -p > "$out"
  local readonly size=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out")
  if [[ "$size" -lt 1000 ]]; then
    log_error "ekran goruntusu bos/kucuk ($size bayt) — cihaz bagli mi, ekran acik mi?"
    return 1
  fi
  log_info "ekran goruntusu: $out ($size bayt) — Read ile ac ve GERCEKTEN BAK"
  echo "$out"
}

function do_logcat {
  local readonly device="$1"
  local readonly a=$(adb_target "$device")
  log_info "son crash / flutter satirlari (salt okunur)"
  $a logcat -d -t 400 2>/dev/null | grep -E 'FATAL EXCEPTION|AndroidRuntime|flutter|Dart|E/' | tail -60 || true
}

function do_install {
  local readonly device="$1"
  local readonly api="$2"
  assert_not_empty "API_BASE_URL" "$api"
  assert_local_api "$api"
  local readonly a=$(adb_target "$device")
  cd "$MOBILE_DIR"
  log_info "debug APK derleniyor (API_BASE_URL=$api, FIREBASE_ENABLED=false)"
  flutter build apk --debug \
    --dart-define=API_BASE_URL="$api" \
    --dart-define=FIREBASE_ENABLED=false >&2
  log_info "adb install -r $APK"
  $a install -r "$APK" >&2
  log_info "kuruldu; uygulamayi acmak icin: $a shell monkey -p com.bagajpark 1"
}

function do_run {
  local readonly device="$1"
  local readonly api="$2"
  assert_not_empty "API_BASE_URL" "$api"
  assert_local_api "$api"
  cd "$MOBILE_DIR"
  log_info "flutter run (hot reload: r, restart: R, cikis: q)"
  if [[ -n "$device" ]]; then
    flutter run -d "$device" \
      --dart-define=API_BASE_URL="$api" \
      --dart-define=FIREBASE_ENABLED=false
  else
    flutter run \
      --dart-define=API_BASE_URL="$api" \
      --dart-define=FIREBASE_ENABLED=false
  fi
}

function main {
  local action=""
  local device=""
  local api=""
  local out=""

  if [[ -f "$ENV_FILE" ]]; then
    # Yalnizca beklenen iki anahtari oku; dosyayi source etme (rastgele kod calismasin).
    device=$(grep -E '^ADB_DEVICE=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true)
    api=$(grep -E '^API_BASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true)
  fi

  while [[ $# > 0 ]]; do
    local key="$1"

    case "$key" in
      --status|--connect|--screencap|--logcat|--install|--run)
        action="$key"
        ;;
      --device)
        device="$2"
        shift
        ;;
      --api)
        api="$2"
        shift
        ;;
      --out)
        out="$2"
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

  if [[ -z "$action" ]]; then
    log_error "bir eylem gerekli (--status, --connect, --screencap, --logcat, --install, --run)"
    print_usage
    exit 1
  fi

  if [[ ! -x "$ADB" ]]; then
    log_error "adb bulunamadi: $ADB (ANDROID_HOME=$ANDROID_HOME)"
    exit 1
  fi
  if [[ ! -f "$ENV_FILE" && ("$action" == "--install" || "$action" == "--run") ]]; then
    log_warn "$ENV_FILE yok; --api ve --device bayraklari gerekir (sablon: scripts/device.env.example)"
  fi

  case "$action" in
    --status)    do_status "$device" ;;
    --connect)   do_connect "$device" ;;
    --screencap) do_screencap "$device" "$out" ;;
    --logcat)    do_logcat "$device" ;;
    --install)   do_install "$device" "$api" ;;
    --run)       do_run "$device" "$api" ;;
  esac
}

main "$@"
