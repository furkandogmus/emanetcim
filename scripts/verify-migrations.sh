#!/bin/bash
# ============================================================
# BagajPark - Migrasyon dogrulama (SALT OKUNUR, gecici DB)
# ============================================================
# Migrasyonlari SIFIRDAN gecici bir veritabanina uygular ve sonucun
# prisma/schema.prisma ile BIREBIR ayni oldugunu dogrular.
#
# NEDEN VAR: 2026-08-22'de sekiz migrasyon ELLE yazilmisti (Docker kapali oldugu
# icin `prisma migrate dev` calistirilamamisti) ve hicbiri gercek bir Postgres'e
# karsi denenmemisti. Denendiginde IKI SAPMA cikti:
#   - PaymentLog.updatedAt sutununda semanin beklemedigi bir DB varsayilani
#   - Shop uzerinde migrasyonun kurdugu ama semanin bilmedigi bir indeks
# Ikisi de deploy'u kirmazdi ama bir sonraki `migrate dev` calistiran kisiye
# aciklanamayan bir "drift" olarak cikardi.
#
# UYGULAMA VERITABANINA DOKUNMAZ. Kendi gecici DB'lerini yaratir ve siler.
# ============================================================

set -e

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_HOST="localhost"
readonly DEFAULT_PORT="5432"

#
# Gecici veritabani adlari ve baglanti bilgisi BETIK KAPSAMINDA.
#
# NEDEN GLOBAL: ilk surumde bunlar `main`'in `local` degiskenleriydi ve temizlik
# `trap ... EXIT` ile yapiliyordu. Trap, `main` DONDUKTEN SONRA calisir; o an
# yerel degiskenler kapsam disidir, yani `DROP DATABASE IF EXISTS ""` calisiyor
# ve sessizce hicbir sey yapmiyordu. Her calistirma iki veritabani sizdirdi
# (14 tanesi birikti). Gercekten calistirilmasaydi fark edilmezdi.
#
CHECK_DB="bagajpark_migcheck_$$"
SHADOW_DB="bagajpark_migshadow_$$"
ADMIN_URL=""

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
  echo "Migrasyonlari sifirdan gecici bir DB'ye uygular ve semayla karsilastirir."
  echo "Uygulama veritabanina DOKUNMAZ."
  echo
  echo "Secenekler:"
  echo -e "  --host\tPostgres sunucusu. Varsayilan: $DEFAULT_HOST"
  echo -e "  --port\tPostgres portu. Varsayilan: $DEFAULT_PORT"
  echo -e "  --user\tPostgres kullanicisi. Varsayilan: \$USER"
  echo -e "  --password\tPostgres parolasi. Verilmezse PGPASSWORD, o da yoksa parolasiz."
  echo -e "  --keep\tGecici veritabanlarini SILME (inceleme icin)"
  echo -e "  --help\tBu metni gosterir"
  echo
  echo "Ornek:"
  echo "  $SCRIPT_NAME"
  echo "  $SCRIPT_NAME --host 127.0.0.1 --port 5433 --user bagajpark"
  echo
}

function assert_is_installed() {
  local -r name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    log_error "'$name' kurulu degil, gerekli"
    exit 1
  fi
}

#
# Prisma baglantiyi acik birakabilir; Postgres uzerinde ACIK BAGLANTI olan bir
# veritabanini dusurmez. Once baglantilari sonlandiriyoruz ve basarisizligi
# YUTMUYORUZ -- ilk surumde `|| true` vardi ve sizintiyi gizliyordu.
#
KEEP_DBS="false"

function drop_db() {
  local -r name="$1"
  [[ -z "$name" || -z "$ADMIN_URL" ]] && return 0
  psql "$ADMIN_URL" -q -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = '$name' AND pid <> pg_backend_pid()" >/dev/null 2>&1 || true
  if ! psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$name\"" >/dev/null 2>&1; then
    log_warn "gecici veritabani silinemedi: $name (elle silin)"
  fi
}

function cleanup() {
  if [[ "$KEEP_DBS" == "true" ]]; then
    log_info "--keep verildi; veritabanlari birakiliyor: $CHECK_DB, $SHADOW_DB"
    return
  fi
  drop_db "$CHECK_DB"
  drop_db "$SHADOW_DB"
}

function main() {
  local host="$DEFAULT_HOST"
  local port="$DEFAULT_PORT"
  local user="${USER:-postgres}"
  local password="${PGPASSWORD:-}"
  local keep="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --host) host="$2"; shift 2 ;;
      --port) port="$2"; shift 2 ;;
      --user) user="$2"; shift 2 ;;
      --password) password="$2"; shift 2 ;;
      --keep) keep="true"; shift ;;
      --help) print_usage; exit 0 ;;
      *)
        log_error "Bilinmeyen secenek: $1"
        print_usage
        exit 1
        ;;
    esac
  done

  assert_is_installed "psql"
  assert_is_installed "npx"

  # Parola varsa URL'ye gomuluyor; yoksa parolasiz baglaniliyor (yerel gelistirme).
  # Deger ekrana HIC basilmiyor.
  local auth="$user"
  if [[ -n "$password" ]]; then
    auth="${user}:${password}"
    export PGPASSWORD="$password"
  fi

  ADMIN_URL="postgresql://${auth}@${host}:${port}/postgres"

  if ! psql "$ADMIN_URL" -c "SELECT 1" >/dev/null 2>&1; then
    log_error "Postgres'e baglanilamadi: ${host}:${port} (kullanici: ${user})"
    log_error "  Yerelde: brew services start postgresql@16"
    log_error "  Docker ile: docker compose up -d postgres  (--port 5433)"
    return 1
  fi

  # POSTGIS ON KONTROLU (2026-08-31'de eklendi).
  #
  # Migrasyonlardan biri `CREATE EXTENSION IF NOT EXISTS postgis` iceriyor
  # (mesafe aramasi onsuz sessizce bellek ici siralamaya dusuyor). Eklenti
  # SISTEMDE kurulu degilse Prisma su hatayi veriyor:
  #
  #   extension "postgis" is not available ... Could not open extension control
  #   file ".../extension/postgis.control"
  #
  # Bu mesaj sorunun NE oldugunu soyluyor ama NE YAPILACAGINI soylemiyor --
  # ozellikle Homebrew Postgres'e bagli bir gelistiricide, ki uretim ve CI
  # `postgis/postgis` imajini kullaniyor. Kapiyi burada ve ANLASILIR bicimde
  # kapatmak, insanlarin onu baypas etmesinden iyidir.
  if ! psql "$ADMIN_URL" -tAc \
      "SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'" \
      2>/dev/null | grep -q 1; then
    log_error "Bu Postgres'te PostGIS YOK: ${host}:${port}"
    # Ters tirnak KULLANILMAZ: cift tirnak icinde komut ikamesine gider ve
    # mesajin kendisi "command not found" uretir (bu satirlar ilk yazildiginda
    # tam olarak oyle oldu -- betigi CALISTIRINCA gorundu).
    log_error "  Migrasyonlar 'CREATE EXTENSION postgis' iceriyor; uretim ve CI"
    log_error "  postgis/postgis:16-3.4-alpine kosuyor."
    log_error "  Compose'daki Postgres'e karsi calistirin:"
    log_error "    docker compose up -d postgres"
    log_error "    $SCRIPT_NAME --host 127.0.0.1 --port 5433 --user bagajpark"
    return 1
  fi

  log_info "Gecici veritabanlari yaratiliyor: $CHECK_DB, $SHADOW_DB"
  psql "$ADMIN_URL" -q -c "CREATE DATABASE \"$CHECK_DB\""
  psql "$ADMIN_URL" -q -c "CREATE DATABASE \"$SHADOW_DB\""

  KEEP_DBS="$keep"
  trap cleanup EXIT

  export DATABASE_URL="postgresql://${auth}@${host}:${port}/${CHECK_DB}?schema=public"
  export SHADOW_DATABASE_URL="postgresql://${auth}@${host}:${port}/${SHADOW_DB}?schema=public"

  log_info "1/2 Migrasyonlar sifirdan uygulaniyor..."
  # `| tee` KULLANILMIYOR: set -e altinda pipeline'in cikis kodu son komuttan
  # gelir ve tee her zaman basarili olur -- hata yutulurdu.
  if ! npx prisma migrate deploy >/dev/null; then
    log_error "Migrasyonlar UYGULANAMADI. Ayrinti icin:"
    log_error "  DATABASE_URL=<gecici db> npx prisma migrate deploy"
    return 1
  fi
  log_info "  ✓ tum migrasyonlar uygulandi"

  log_info "2/2 Sema ile migrasyonlar karsilastiriliyor..."
  local diff_output
  diff_output=$(npx prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema prisma/schema.prisma 2>&1) || true

  if echo "$diff_output" | grep -q "No difference detected"; then
    log_info "  ✓ SAPMA YOK -- migrasyonlar semayla birebir"
    return 0
  fi

  log_error "  SAPMA VAR. Migrasyonlarin urettigi sema, schema.prisma ile ayni degil:"
  echo "$diff_output" | sed 's/^/    /' >&2
  log_error "  Bu, bir sonraki 'prisma migrate dev' calistiran kisiye aciklanamayan"
  log_error "  bir drift olarak cikar. Migrasyonu veya semayi duzeltin."
  return 1
}

main "$@"
