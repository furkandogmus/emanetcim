#!/bin/bash
# ============================================================
# BagajPark - Test (bypass) rezervasyonlarinin kapatilmasi
# ============================================================
# Cikis saati gecmis, ACIK durumdaki test rezervasyonlarini CANCELLED'a alir.
#
# NEDEN: 2026-08-29 olcumunde acik 17 rezervasyonun tamami test verisiydi:
#   - 11 tanesi PAID ve UCUNUN DE islem numarasi `bypass_` ile basliyor, yani
#     MOBILE_PAYMENT_BYPASS bayragiyla uretilmis; gercek para hic gecmemis.
#   - 6 tanesi APPROVED ve hicbir odeme kaydi yok.
# En yeni rezervasyon 2026-08-23; hepsi Haziran-Agustos gelistirme donemi.
#
# NEDEN SERVIS DEGIL: BookingService.cancelBooking dogru yol olurdu ve iadeyi
# PaymentService uzerinden kendi yapardi -- ama urunde onu cagiran HTTP yolu
# yalnizca kullanici arayuzu (cancelBookingAction). 17 kayit icin 17 tiklama
# makul degil. Bu bir is operasyonu degil, VERI ONARIMI: uretim veritabanina
# karismis gelistirme kayitlarinin temizligi.
#
# ODEME DURUMU: SUCCESS -> REFUNDED gecisi, PaymentService'in durum makinesinin
# (PaymentService.ts:56) IZIN VERDIGI gecistir; burada elle uygulaniyor.
# Uydurma bir gecis yapilmiyor. `refundedAmount` da brute esitleniyor ki
# raporlarda karsiligi olmayan gelir kalmasin.
#
# KAPSAM BILEREK DAR. Yalnizca su iki gruba dokunur:
#   a) hic PaymentLog'u olmayanlar,
#   b) PaymentLog.transactionId'si `bypass_` ile baslayanlar.
# GERCEK bir tahsilat (bypass olmayan SUCCESS) ASLA kapsanmaz -- boyle bir kayit
# icin bu script durur ve size soyler. Gercek parayi elle "iade edilmis"
# isaretlemek, bu projeyi bu hale getiren hata sinifinin ta kendisi olurdu.
#
# VARSAYILAN KURU CALISMADIR. Degistirmek icin `--apply` gerekir.
#
# Ayrinti: docs/DEFECT_BACKLOG.md -> madde 6
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_APP_DIR="/opt/emanetci"

function log()       { >&2 echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"; }
function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME [SECENEKLER]"
  echo
  echo "Cikis saati gecmis ACIK test rezervasyonlarini CANCELLED yapar."
  echo "Yalnizca odemesiz VEYA bypass_ odemeli kayitlara dokunur."
  echo
  echo "Secenekler:"
  echo -e "  --app-dir\tUygulama dizini. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --apply\tGercekten degistir. Yoksa yalnizca listeler."
  echo -e "  --help\tBu yardim."
  echo
}

function assert_is_installed() {
  local -r bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    log_error "'$bin' kurulu degil."; exit 1
  fi
}

# psql host'ta kurulu DEGIL ve env'deki DATABASE_URL olu bir veritabanini
# gosteriyor (bkz. DEFECT_BACKLOG madde 8). Sorgular konteynerden kosuyor.
function psql_run() {
  local -r app_dir="$1"; shift
  docker compose --project-directory "$app_dir" --env-file "$app_dir/docker-compose.env" \
    exec -T postgres psql -U bagajpark -d bagajpark -v ON_ERROR_STOP=1 "$@"
}

function main() {
  local app_dir="$DEFAULT_APP_DIR"
  local apply="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --app-dir) app_dir="$2"; shift 2 ;;
      --apply)   apply="true"; shift ;;
      --help)    print_usage; exit 0 ;;
      *)         log_error "Bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  assert_is_installed "docker"

  local -r open_and_overdue="b.status IN ('PENDING','WAITING_APPROVAL','APPROVED','PAID','CHECKED_IN')
      AND b.\"checkOutTime\" < now()"
  local -r is_test="(p.id IS NULL OR p.\"transactionId\" LIKE 'bypass_%')"

  # ONCE GUVENLIK KONTROLU: kapsam disinda kalan GERCEK bir tahsilat var mi?
  # Varsa hicbir sey yapilmaz -- karisik bir kumede korlemesine islem yapmak,
  # tam olarak kacinmaya calistigimiz sey.
  local real_paid
  real_paid=$(psql_run "$app_dir" -t -A -c "
    SELECT count(*) FROM \"Booking\" b
    LEFT JOIN \"PaymentLog\" p ON p.\"bookingId\" = b.id
    WHERE $open_and_overdue
      AND p.status = 'SUCCESS'
      AND (p.\"transactionId\" IS NULL OR p.\"transactionId\" NOT LIKE 'bypass_%');" | tr -d '[:space:]')

  if [[ "$real_paid" != "0" ]]; then
    log_error "$real_paid kayitta GERCEK tahsilat var (bypass degil)."
    log_error "  Bu script onlara dokunmaz ve karisik bir kumede calismaz."
    log_error "  O kayitlari once normal iptal akisindan iptal edin"
    log_error "  (cancelBooking -> PaymentService.refund), sonra tekrar kosun."
    exit 1
  fi

  log_info "Etkilenecek kayitlar (salt okunur):"
  psql_run "$app_dir" -c "
    SELECT b.status, count(*) AS adet,
           count(*) FILTER (WHERE p.id IS NULL)                       AS odemesiz,
           count(*) FILTER (WHERE p.\"transactionId\" LIKE 'bypass_%') AS bypass
    FROM \"Booking\" b
    LEFT JOIN \"PaymentLog\" p ON p.\"bookingId\" = b.id
    WHERE $open_and_overdue AND $is_test
    GROUP BY b.status ORDER BY b.status;"

  local affected
  affected=$(psql_run "$app_dir" -t -A -c "
    SELECT count(*) FROM \"Booking\" b
    LEFT JOIN \"PaymentLog\" p ON p.\"bookingId\" = b.id
    WHERE $open_and_overdue AND $is_test;" | tr -d '[:space:]')
  log_info "Kapatilacak rezervasyon: $affected"

  if [[ "$affected" == "0" ]]; then
    log_info "Yapacak bir sey yok."
    return 0
  fi

  if [[ "$apply" != "true" ]]; then
    log_warn "KURU KOSU -- hicbir sey degistirilmedi. Uygulamak icin --apply ekleyin."
    return 0
  fi

  # Tek transaction: yarim kalan bir temizlik, odemesi REFUNDED ama rezervasyonu
  # hala acik kayitlar birakirdi.
  psql_run "$app_dir" -c "
    BEGIN;

    -- 1) bypass odemelerini REFUNDED yap. SUCCESS -> REFUNDED, durum
    --    makinesinin izin verdigi gecis. refundedAmount brute esitlenir ki
    --    raporda karsiligi olmayan gelir kalmasin.
    UPDATE \"PaymentLog\" p
    SET status = 'REFUNDED',
        \"refundedAmount\" = p.amount,
        \"refundedAt\" = now(),
        \"failureReason\" = 'test verisi (bypass) - gercek tahsilat yok',
        \"updatedAt\" = now()
    FROM \"Booking\" b
    WHERE p.\"bookingId\" = b.id
      AND $open_and_overdue
      AND p.\"transactionId\" LIKE 'bypass_%'
      AND p.status = 'SUCCESS';

    -- 2) rezervasyonlari kapat
    UPDATE \"Booking\" b SET status = 'CANCELLED', \"updatedAt\" = now()
    FROM (SELECT b2.id FROM \"Booking\" b2
          LEFT JOIN \"PaymentLog\" p2 ON p2.\"bookingId\" = b2.id
          WHERE b2.status IN ('PENDING','WAITING_APPROVAL','APPROVED','PAID','CHECKED_IN')
            AND b2.\"checkOutTime\" < now()
            AND (p2.id IS NULL OR p2.\"transactionId\" LIKE 'bypass_%')) t
    WHERE b.id = t.id;

    -- 3) bos yere yer tutan slotlari birak
    DELETE FROM \"ReservationSlot\" rs
    USING \"Booking\" b
    WHERE rs.\"bookingId\" = b.id AND b.status = 'CANCELLED';

    COMMIT;"

  log_info "Tamamlandi. Kalan acik+gecikmis rezervasyon:"
  psql_run "$app_dir" -t -A -c "
    SELECT count(*) FROM \"Booking\"
    WHERE status IN ('PENDING','WAITING_APPROVAL','APPROVED','PAID','CHECKED_IN')
      AND \"checkOutTime\" < now();"
}

main "$@"
