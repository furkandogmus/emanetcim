#!/bin/bash
# BagajPark mobil dogrulama kapisi: analyze + test + bicim + mandal.
# CI'daki mobile-ci.yml ile AYNI bayraklari kullanir; yerelde yesilse CI'da da yesildir.
# Salt okunur (uretilmis dosyalar haric hicbir seyi degistirmez); --update-baseline
# yalnizca mandal dosyasini DUSURUR.

set -e

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly BASELINE_FILE="${SCRIPT_DIR}/analyze-baseline.count"
readonly LOG_DIR="${SCRIPT_DIR}/logs"

LOG_FILE=""

function log {
  local readonly level="$1"
  local readonly message="$2"
  local readonly timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  local readonly line="${timestamp} [${level}] [$SCRIPT_NAME] ${message}"

  >&2 echo -e "$line"

  if [[ -n "$LOG_FILE" ]]; then
    echo -e "$line" >> "$LOG_FILE"
  fi
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
  echo "Mobil dogrulama kapisi. Sirasiyla: (1) build_runner (istege bagli),"
  echo "(2) flutter analyze --no-fatal-infos + mandal, (3) flutter test,"
  echo "(4) degisen .dart dosyalarinda dart format. Herhangi biri kirmiziysa exit 1."
  echo
  echo "Options:"
  echo
  echo -e "  --gen\t\t\tOnce 'dart run build_runner build' calistir. Optional."
  echo -e "  --skip-test\t\tflutter test adimini atla (hizli tur). Optional."
  echo -e "  --base <ref>\t\tBicim kontrolunde karsilastirma tabani. Default: HEAD."
  echo -e "  --update-baseline\tAnalyze sayisi mandaldan DUSUKSE mandali guncelle. Optional."
  echo -e "  --log-file <path>\tCiktiyi bu dosyaya da yaz. Default: scripts/logs/<UTC>.log"
  echo -e "  --no-log-file\t\tYalnizca terminal."
  echo -e "  --help\t\tBu metin."
  echo
  echo "Example:"
  echo
  echo "  $SCRIPT_NAME                    # tam kapi"
  echo "  $SCRIPT_NAME --skip-test        # analyze + bicim, ~10 sn"
  echo "  $SCRIPT_NAME --update-baseline  # uyari sayisini dusurdukten sonra"
}

function assert_is_installed {
  local readonly name="$1"

  if [[ ! $(command -v ${name}) ]]; then
    log_error "'$name' bulunamadi (PATH'te degil)."
    exit 1
  fi
}

function run_gen {
  log_info "build_runner calisiyor (freezed/retrofit/riverpod)"
  if dart run build_runner build --delete-conflicting-outputs >> "${LOG_FILE:-/dev/null}" 2>&1; then
    log_info "build_runner tamam"
  else
    log_error "build_runner basarisiz — ayrinti: ${LOG_FILE:-terminal}"
    return 1
  fi
}

# Analyze ciktisindaki toplam issue sayisini basar (0 dahil). Hata/uyari varsa
# global ANALYZE_FAILED=1 (CI --no-fatal-infos ile ayni: info dusurmez).
ANALYZE_FAILED=0
function run_analyze {
  local out=""
  local status=0
  out=$(flutter analyze --no-fatal-infos 2>&1) || status=$?
  if [[ -n "$LOG_FILE" ]]; then
    printf '%s\n' "$out" >> "$LOG_FILE"
  fi

  local count
  count=$(printf '%s\n' "$out" | grep -oE '^[0-9]+ issues? found' | grep -oE '^[0-9]+' || true)
  if printf '%s\n' "$out" | grep -q 'No issues found'; then
    count=0
  fi
  if [[ -z "$count" ]]; then
    log_error "analyze ciktisi cozumlenemedi"
    printf '%s\n' "$out" | tail -20 >&2
    ANALYZE_FAILED=1
    echo "-1"
    return 0
  fi

  if [[ "$status" -ne 0 ]]; then
    ANALYZE_FAILED=1
    printf '%s\n' "$out" | grep -E '^\s*(error|warning)' >&2 || true
  fi
  echo "$count"
}

function check_baseline {
  local readonly count="$1"
  local readonly update="$2"

  if [[ ! -f "$BASELINE_FILE" ]]; then
    log_warn "mandal dosyasi yok ($BASELINE_FILE); olusturuluyor: $count"
    echo "$count" > "$BASELINE_FILE"
    return 0
  fi

  local readonly baseline=$(cat "$BASELINE_FILE" | tr -d '[:space:]')
  if [[ "$count" -gt "$baseline" ]]; then
    log_error "MANDAL: analyze $count issue, tavan $baseline. Yeni uyari eklendi; once onu kaldir."
    return 1
  fi
  if [[ "$count" -lt "$baseline" ]]; then
    if [[ "$update" == "true" ]]; then
      echo "$count" > "$BASELINE_FILE"
      log_info "mandal dusuruldu: $baseline -> $count ($BASELINE_FILE)"
    else
      log_info "analyze $count issue (tavan $baseline). Dusurmek icin: --update-baseline"
    fi
  else
    log_info "analyze $count issue (tavan $baseline) — degismedi"
  fi
}

function run_tests {
  local out=""
  local status=0
  out=$(flutter test 2>&1) || status=$?
  if [[ -n "$LOG_FILE" ]]; then
    printf '%s\n' "$out" >> "$LOG_FILE"
  fi
  local readonly summary=$(printf '%s\n' "$out" | grep -E '^[0-9:]+ \+[0-9]+' | tail -1 | sed -E 's/^[0-9:]+ //')
  if [[ "$status" -ne 0 ]]; then
    log_error "flutter test KIRMIZI ($summary)"
    printf '%s\n' "$out" | grep -A3 -E 'Failing tests:|\[E\]' | head -30 >&2
    return 1
  fi
  log_info "flutter test yesil ($summary)"
}

# CI'daki "yeni borc yasak" kuralinin yerel esdegeri: BASE'te zaten bicim disi olan
# dosya atlanir, temiz ya da yeni olan dosya bicimli olmak ZORUNDA.
function check_format {
  local readonly base="$1"
  local files
  files=$( (git diff --name-only --diff-filter=ACMR "$base" -- '*.dart'; \
            git ls-files --others --exclude-standard -- '*.dart') 2>/dev/null \
          | sed 's|^mobile/||' | sort -u || true)
  if [[ -z "$files" ]]; then
    log_info "bicim: degisen .dart dosyasi yok"
    return 0
  fi

  local bad=""
  local skipped=""
  local f
  for f in $files; do
    [[ -f "$f" ]] || continue
    case "$f" in *.g.dart|*.freezed.dart) continue ;; esac
    local was_clean=1
    if git show "$base:mobile/$f" > /tmp/verify-base.dart 2>/dev/null; then
      dart format --output=none --set-exit-if-changed /tmp/verify-base.dart >/dev/null 2>&1 || was_clean=0
    fi
    if [[ "$was_clean" -eq 0 ]]; then
      skipped="$skipped $f"
      continue
    fi
    dart format --output=none --set-exit-if-changed "$f" >/dev/null 2>&1 || bad="$bad $f"
  done
  rm -f /tmp/verify-base.dart

  [[ -n "$skipped" ]] && log_warn "eski bicim borcu, atlandi:$skipped"
  if [[ -n "$bad" ]]; then
    log_error "bicim disi ve ONCEDEN TEMIZDI:$bad"
    log_error "duzelt: dart format$bad"
    return 1
  fi
  log_info "bicim: yeni borc yok"
}

function main {
  local gen="false"
  local skip_test="false"
  local base="HEAD"
  local update_baseline="false"
  local log_file_arg=""
  local no_log_file="false"

  while [[ $# > 0 ]]; do
    local key="$1"

    case "$key" in
      --gen)
        gen="true"
        ;;
      --skip-test)
        skip_test="true"
        ;;
      --base)
        base="$2"
        shift
        ;;
      --update-baseline)
        update_baseline="true"
        ;;
      --log-file)
        log_file_arg="$2"
        shift
        ;;
      --no-log-file)
        no_log_file="true"
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

  assert_is_installed "flutter"
  assert_is_installed "dart"
  assert_is_installed "git"

  cd "$MOBILE_DIR"

  if [[ "$no_log_file" != "true" ]]; then
    local candidate=""
    if [[ -n "$log_file_arg" ]]; then
      candidate="$log_file_arg"
    else
      mkdir -p "$LOG_DIR"
      candidate="${LOG_DIR}/verify-$(date -u +"%Y%m%dT%H%M%SZ").log"
    fi
    if ! touch "$candidate" 2>/dev/null; then
      log_error "log dosyasi yazilamiyor: '$candidate'"
      exit 1
    fi
    LOG_FILE="$candidate"
    log_info "log dosyasi : $LOG_FILE"
  fi

  local failed=0

  if [[ "$gen" == "true" ]]; then
    run_gen || failed=1
  fi

  log_info "flutter analyze --no-fatal-infos"
  local count
  count=$(run_analyze)
  if [[ "$ANALYZE_FAILED" -eq 1 ]]; then
    log_error "analyze: hata/uyari var (info degil) — CI burada kirmizi duser"
    failed=1
  fi
  if [[ "$count" -ge 0 ]]; then
    check_baseline "$count" "$update_baseline" || failed=1
  fi

  if [[ "$skip_test" != "true" ]]; then
    log_info "flutter test"
    run_tests || failed=1
  else
    log_warn "flutter test ATLANDI (--skip-test)"
  fi

  log_info "bicim kontrolu (taban: $base)"
  check_format "$base" || failed=1

  if [[ "$failed" -ne 0 ]]; then
    log_error "KAPI KIRMIZI"
    exit 1
  fi
  log_info "KAPI YESIL"
}

main "$@"
