#!/bin/bash
# ============================================================
# BagajPark - Takilmis CHECKED_IN rezervasyon onarimi
# ============================================================
# Cikis saati COKTAN gecmis, muhru olmayan ve odemesi bulunmayan `CHECKED_IN`
# rezervasyonlari `CANCELLED`a alir.
#
# NEDEN: 2026-08-29 olcumunde uc rezervasyon 12-14 Haziran'dan beri `CHECKED_IN`
# duruyordu -- 78 gun. Ucunde de MUHUR YOK, ikisinde ODEME KAYDI YOK ve biri
# "Furkan'in Diger Mekan" adli test dukkaninda. Gercek bir musterinin bavulu 78
# gundur dukkanda olsaydi hem odemesi hem muhru olurdu; bunlar gelistirme
# sirasinda birakilmis kayitlar.
#
# NEDEN SERVIS DEGIL: BookingService.cancelBooking `CHECKED_IN` durumunu KASTEN
# reddeder (src/services/booking/lifecycle.ts:72) -- bavul dukkandayken iptal bir
# is kurali olarak yanlistir. Bu bir is operasyonu degil, VERI ONARIMI: kayit
# zaten anlamsiz bir durumda takilmis. repair-seal-ownership.sh ile ayni sinif.
#
# NEDEN ONEMLI: booking-reminders isi acildiginda bu kayitlar icin esnafa her
# kosuda uyari gider ("bildirildi" isareti yok), yani iki esnaf her gun
# Haziran'dan kalma bir bildirim alir. Kayitlar temizlenmeden cron kurulamaz.
#
# VARSAYILAN KURU CALISMADIR. Gercekten degistirmek icin `--apply` gerekir.
#
# ODEMESI OLAN KAYITLARA DOKUNMAZ. `--include-paid` verilmedikce tahsil edilmis
# odemesi olan bir rezervasyon atlanir: iptal, karsiligi olan bir SUCCESS odeme
# kaydini oksuz birakir ve raporda karsiligi olmayan gelir gorunur -- bu projeyi
# bu hale getiren hata sinifinin ta kendisi. O kayit icin once para tarafina
# karar verilir (PaymentService.refund), sonra bu script tekrar kosulur.
#
# Ayrinti: docs/DEFECT_BACKLOG.md -> madde 6, scripts/README.md
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_APP_DIR="/opt/emanetci"
readonly DEFAULT_MIN_AGE_DAYS="30"

function log()       { >&2 echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"; }
function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME [SECENEKLER]"
  echo
  echo "Cikis saati --min-age-days'ten eski, muhursuz CHECKED_IN rezervasyonlari"
  echo "CANCELLED'a alir. Varsayilan KURU KOSU."
  echo
  echo "Secenekler:"
  echo -e "  --app-dir\tUygulama dizini. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --min-age-days\tCikistan bu kadar gun gecmis olmali. Varsayilan: $DEFAULT_MIN_AGE_DAYS"
  echo -e "  --apply\tGercekten degistir."
  echo -e "  --include-paid\tTahsil edilmis odemesi olanlari da kapsa. TEHLIKELI --"
  echo -e "\t\tkarsiligi olmayan gelir birakir; once PaymentService.refund."
  echo -e "  --revert-to-paid <id>\tTEK bir kaydi CHECKED_IN'den PAID'e geri alir."
  echo -e "\t\tOdemesi olan kayitlar icin dogru yol budur: PAID'e donunce"
  echo -e "\t\tnormal iptal akisi (cancelBookingAction) calisir ve iadeyi"
  echo -e "\t\tPaymentService uzerinden KENDI yapar -- denetim izi, slot"
  echo -e "\t\ttemizligi ve paylasim geri alimi dahil. Kimlik ZORUNLU."
  echo -e "  --help\tBu yardim."
  echo
}

function assert_is_installed() {
  local -r bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    log_error "'$bin' kurulu degil."; exit 1
  fi
}

# psql HOST'ta kurulu degil (2026-08-29'da dogrulandi) ve env dosyasindaki
# DATABASE_URL var olmayan bir veritabanini gosteriyor. Bu yuzden sorgular
# konteyner icindeki psql ile, compose'un kendi kurdugu baglantiyla kosuyor.
function psql_run() {
  local -r app_dir="$1"; shift
  docker compose --project-directory "$app_dir" --env-file "$app_dir/docker-compose.env" \
    exec -T postgres psql -U "${POSTGRES_USER:-bagajpark}" -d "${POSTGRES_DB:-bagajpark}" \
    -v ON_ERROR_STOP=1 "$@"
}

function main() {
  local app_dir="$DEFAULT_APP_DIR"
  local min_age_days="$DEFAULT_MIN_AGE_DAYS"
  local apply="false"
  local include_paid="false"
  local revert_id=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --app-dir)       app_dir="$2"; shift 2 ;;
      --min-age-days)  min_age_days="$2"; shift 2 ;;
      --apply)         apply="true"; shift ;;
      --include-paid)  include_paid="true"; shift ;;
      --revert-to-paid) revert_id="$2"; shift 2 ;;
      --help)          print_usage; exit 0 ;;
      *)               log_error "Bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  assert_is_installed "docker"

  # --revert-to-paid: tek kayit, acik kimlikle. Desen eslesmesi YOK -- bu mod
  # odemesi olan kayitlara dokundugu icin yanlislikla suprulmesi imkansiz olmali.
  if [[ -n "$revert_id" ]]; then
    log_info "Hedef kayit (salt okunur):"
    psql_run "$app_dir" -c "
      SELECT left(b.id,8) AS rez, b.status, s.name AS dukkan,
             to_char(b.\"checkOutTime\",'YYYY-MM-DD') AS cikis,
             (SELECT count(*) FROM \"BookingSeal\" x WHERE x.\"bookingId\"=b.id) AS muhur,
             COALESCE(p.status::text,'(yok)') AS odeme
      FROM \"Booking\" b JOIN \"Shop\" s ON s.id=b.\"shopId\"
      LEFT JOIN \"PaymentLog\" p ON p.\"bookingId\"=b.id
      WHERE b.id LIKE '${revert_id}%';"

    local n
    n=$(psql_run "$app_dir" -t -A -c "
      SELECT count(*) FROM \"Booking\" b
      WHERE b.id LIKE '${revert_id}%' AND b.status='CHECKED_IN'
        AND NOT EXISTS (SELECT 1 FROM \"BookingSeal\" x WHERE x.\"bookingId\"=b.id);" | tr -d '[:space:]')
    if [[ "$n" != "1" ]]; then
      log_error "Tam olarak 1 uygun kayit bekleniyordu, $n bulundu."
      log_error "  Kosul: status=CHECKED_IN ve muhru olmayan. Kimligi netlestirin."
      exit 1
    fi
    if [[ "$apply" != "true" ]]; then
      log_warn "KURU KOSU -- PAID'e alinmadi. Uygulamak icin --apply ekleyin."
      return 0
    fi
    psql_run "$app_dir" -c "
      UPDATE \"Booking\" SET status='PAID', \"updatedAt\"=now()
      WHERE id LIKE '${revert_id}%' AND status='CHECKED_IN';"
    log_info "Kayit PAID'e alindi."
    log_warn "SIRADAKI ADIM SIZDE: rezervasyonu normal iptal akisindan iptal edin."
    log_warn "  Iadeyi cancelBooking -> PaymentService.refund kendi yapacak."
    return 0
  fi

  # Odemesi olanlari disarida birakan kosul. --include-paid ile gevsetilir.
  local paid_filter="AND NOT EXISTS (SELECT 1 FROM \"PaymentLog\" p WHERE p.\"bookingId\" = b.id AND p.status = 'SUCCESS')"
  if [[ "$include_paid" == "true" ]]; then
    paid_filter=""
    log_warn "--include-paid verildi: tahsil edilmis odemesi olan kayitlar da kapsanacak."
  fi

  local -r where="b.status = 'CHECKED_IN'
      AND b.\"checkOutTime\" < now() - interval '$min_age_days days'
      AND NOT EXISTS (SELECT 1 FROM \"BookingSeal\" s WHERE s.\"bookingId\" = b.id)
      $paid_filter"

  log_info "Etkilenecek kayitlar (salt okunur):"
  psql_run "$app_dir" -c "
    SELECT left(b.id,8) AS rez, s.name AS dukkan,
           to_char(b.\"checkOutTime\",'YYYY-MM-DD') AS cikis,
           date_part('day', now() - b.\"checkOutTime\")::int AS gun,
           b.\"totalPrice\" AS tutar
    FROM \"Booking\" b JOIN \"Shop\" s ON s.id = b.\"shopId\"
    WHERE $where ORDER BY b.\"checkOutTime\";"

  local affected
  affected=$(psql_run "$app_dir" -t -A -c "SELECT count(*) FROM \"Booking\" b WHERE $where" | tr -d '[:space:]')
  log_info "Onarilacak satir sayisi: $affected"

  # Odemesi oldugu icin ATLANANLARI ayrica bildir -- sessizce atlamak, o
  # kayitlarin unutulmasi demek olurdu.
  if [[ "$include_paid" != "true" ]]; then
    local skipped
    skipped=$(psql_run "$app_dir" -t -A -c "
      SELECT count(*) FROM \"Booking\" b
      WHERE b.status='CHECKED_IN'
        AND b.\"checkOutTime\" < now() - interval '$min_age_days days'
        AND NOT EXISTS (SELECT 1 FROM \"BookingSeal\" s WHERE s.\"bookingId\"=b.id)
        AND EXISTS (SELECT 1 FROM \"PaymentLog\" p WHERE p.\"bookingId\"=b.id AND p.status='SUCCESS')
      " | tr -d '[:space:]')
    if [[ "$skipped" != "0" ]]; then
      log_warn "$skipped kayit ODEMESI OLDUGU ICIN atlandi. Once para tarafina karar verin"
      log_warn "  (PaymentService.refund), sonra bu scripti tekrar kosun."
    fi
  fi

  if [[ "$affected" == "0" ]]; then
    log_info "Onarilacak bir sey yok."
    return 0
  fi

  if [[ "$apply" != "true" ]]; then
    log_warn "KURU KOSU -- hicbir sey degistirilmedi. Uygulamak icin --apply ekleyin."
    return 0
  fi

  psql_run "$app_dir" -c "
    UPDATE \"Booking\" b SET status='CANCELLED', \"updatedAt\"=now()
    WHERE $where;"
  log_info "$affected rezervasyon CANCELLED yapildi."

  log_info "Kalan acik CHECKED_IN sayisi:"
  psql_run "$app_dir" -t -A -c "SELECT count(*) FROM \"Booking\" WHERE status='CHECKED_IN';"
}

main "$@"
