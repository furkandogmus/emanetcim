#!/bin/bash
# ============================================================
# BagajPark - Yanlis saat diliminde uretilmis slotlarin onarimi
# ============================================================
# Dukkanin ACIK OLMADIGI saatlere dusen GELECEK slotlari siler.
#
# NEDEN: 2026-08-24'te bulundu. `generateSlotsForShop` duvar saatini
# `new Date("2026-06-15T09:00:00")` ile ana ceviriyordu. Saat dilimi eki OLMAYAN
# bir ISO dizesi calisma ortaminin YEREL saatine gore ayrilir; konteynerde TZ
# ayarli olmadigi icin prod UTC. Sonuc: 09:00-20:00 acik bir Istanbul dukkaninin
# slotlari 09:00Z-20:00Z uretiliyordu, yani misafirin takviminde 12:00-23:00.
#
#   - dukkan ACIKKEN (09:00-12:00) hic slot yok  -> arama dukkani eliyor
#   - dukkan KAPALIYKEN (20:00-23:00) slot var   -> misafir rezervasyon yapiyor,
#     geliyor, `isShopOpenAt` check-in'i reddediyor (tezgahin basinda, valizle)
#
# Kod duzeltildi (`src/services/SlotService.ts`). Ama uretim `upsert` ile
# (shopId, startTime) uzerinden calisiyor: is tekrar kostugunda DOGRU slotlar
# EKLENIR, yanlis olanlar YERINDE KALIR. Yani ikisi bir arada durur ve misafir
# hala kapali saate rezervasyon yapabilir. Bu script yanlis olanlari temizler.
#
# GUVENLIK: rezervasyonu OLAN hicbir slota dokunulmaz ve GECMIS slotlar
# korunur -- ikisi de tarihsel kayittir.
#
# VARSAYILAN KURU CALISMADIR. Hicbir sey degistirmez, yalnizca ne yapacagini
# soyler. Gercekten silmek icin `--apply` gerekir.
#
# SIRALAMA: once bu script (--apply), sonra slot uretimi tekrar kosulmali:
#   scripts/repair-slot-timezone.sh --apply
#   scripts/generate-slots.sh
#
# Ayrinti: docs/DEFECT_BACKLOG.md -> 2026-08-24 slot uretimi P0
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
  echo "Dukkanin acik olmadigi saatlere dusen GELECEK slotlari siler."
  echo "Rezervasyonu olan slotlara ve gecmis slotlara DOKUNMAZ."
  echo "VARSAYILAN KURU CALISMADIR -- silmek icin --apply gerekir."
  echo
  echo "Secenekler:"
  echo -e "  --apply\t\tGERCEKTEN sil. Bu bayrak olmadan hicbir sey silinmez."
  echo -e "  --app-dir\t.env dosyasinin bulundugu dizin. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --help\t\tBu metni gosterir"
  echo
  echo "Ornek:"
  echo "  $SCRIPT_NAME                # ne silecegini gosterir, dokunmaz"
  echo "  $SCRIPT_NAME --apply        # siler; sonra generate-slots.sh calistirin"
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

# Kapali saate dusen, GELECEK ve rezervasyonsuz slotlari secen kosul.
#
# `open247` dukkanlar her saat acik oldugu icin haric tutulur. Acilis/kapanis
# karsilastirmasi dukkanin KENDI saat diliminde yapilir (`AT TIME ZONE`) --
# hatanin kaynagi zaten bu donusumun atlanmasiydi.
readonly WHERE_CLAUSE="
  FROM \"ShopTimeSlot\" s
  JOIN \"Shop\" sh ON sh.id = s.\"shopId\"
  WHERE s.\"startTime\" > NOW()
    AND sh.\"open247\" = false
    AND sh.\"openingTime\" IS NOT NULL
    AND sh.\"closingTime\" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM \"ReservationSlot\" rs WHERE rs.\"slotId\" = s.id
    )
    AND (
      (s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone, 'Europe/Istanbul'))::time
        < sh.\"openingTime\"::time
      OR
      (s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone, 'Europe/Istanbul'))::time
        >= sh.\"closingTime\"::time
    )
"

function main() {
  local apply="false"
  local app_dir="$DEFAULT_APP_DIR"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --apply)   apply="true"; shift ;;
      --app-dir) app_dir="$2"; shift 2 ;;
      --help)    print_usage; exit 0 ;;
      *)
        log_error "Bilinmeyen secenek: $1"
        print_usage
        exit 1
        ;;
    esac
  done

  assert_is_installed "docker"

  log_info "Mevcut durum okunuyor (salt okunur)..."
  psql_run "$app_dir" -c "
    SELECT sh.name AS dukkan,
           sh.timezone,
           sh.\"openingTime\" AS acilis,
           sh.\"closingTime\" AS kapanis,
           COUNT(*) AS gelecek_slot,
           MIN((s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone,'Europe/Istanbul'))::time) AS ilk_slot_yerel,
           MAX((s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone,'Europe/Istanbul'))::time) AS son_slot_yerel
    FROM \"ShopTimeSlot\" s
    JOIN \"Shop\" sh ON sh.id = s.\"shopId\"
    WHERE s.\"startTime\" > NOW()
    GROUP BY sh.id, sh.name, sh.timezone, sh.\"openingTime\", sh.\"closingTime\"
    ORDER BY sh.name;"

  log_info "Silinecek (kapali saate dusen, rezervasyonsuz, gelecek) slotlar:"
  psql_run "$app_dir" -c "
    SELECT sh.name AS dukkan, COUNT(*) AS silinecek
    $WHERE_CLAUSE
    GROUP BY sh.name ORDER BY sh.name;"

  local affected
  affected=$(psql_run "$app_dir" -t -A -c "SELECT COUNT(*) $WHERE_CLAUSE;")

  log_info "Toplam silinecek satir: $affected"

  # Rezervasyonu OLAN ve kapali saate dusen slotlar: bunlar elle bakilmali.
  local booked
  booked=$(psql_run "$app_dir" -t -A -c "
    SELECT COUNT(*)
    FROM \"ShopTimeSlot\" s
    JOIN \"Shop\" sh ON sh.id = s.\"shopId\"
    WHERE s.\"startTime\" > NOW()
      AND sh.\"open247\" = false
      AND EXISTS (SELECT 1 FROM \"ReservationSlot\" rs WHERE rs.\"slotId\" = s.id)
      AND (
        (s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone,'Europe/Istanbul'))::time < sh.\"openingTime\"::time
        OR
        (s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone,'Europe/Istanbul'))::time >= sh.\"closingTime\"::time
      );")

  if [[ "$booked" != "0" ]]; then
    log_warn "DIKKAT: $booked slot kapali saate dusuyor ANCAK rezervasyonu var."
    log_warn "Bunlara DOKUNULMAYACAK. Misafir dukkan kapaliyken gelecek demektir --"
    log_warn "her biri icin esnafla konusulup misafire yeni saat onerilmeli."
  fi

  if [[ "$affected" == "0" ]]; then
    log_info "Silinecek bir sey yok."
    return 0
  fi

  if [[ "$apply" != "true" ]]; then
    log_warn "KURU CALISMA -- hicbir sey silinmedi."
    log_warn "Gercekten silmek icin: $SCRIPT_NAME --apply"
    return 0
  fi

  log_info "Siliniyor ($affected satir)..."
  psql_run "$app_dir" -c "
    DELETE FROM \"ShopTimeSlot\" s
    USING \"Shop\" sh
    WHERE sh.id = s.\"shopId\"
      AND s.\"startTime\" > NOW()
      AND sh.\"open247\" = false
      AND sh.\"openingTime\" IS NOT NULL
      AND sh.\"closingTime\" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM \"ReservationSlot\" rs WHERE rs.\"slotId\" = s.id)
      AND (
        (s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone,'Europe/Istanbul'))::time < sh.\"openingTime\"::time
        OR
        (s.\"startTime\" AT TIME ZONE COALESCE(sh.timezone,'Europe/Istanbul'))::time >= sh.\"closingTime\"::time
      );"
  log_info "Silme tamamlandi."
  log_warn "SIRADAKI ADIM zorunlu: scripts/generate-slots.sh"
  log_warn "Dogru saatlerdeki slotlar ancak o is kostuktan sonra olusur."

  return 0
}

main "$@"
