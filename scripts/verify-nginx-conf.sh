#!/bin/bash
# ============================================================
# BagajPark - nginx konfigini gercek nginx'e dogrulat
# ============================================================
# nginx/conf.d/*.conf dosyalarini gercek bir nginx binary'sine `nginx -t` ile
# sinatir. Repoyu DEGISTIRMEZ: dosyalari gecici bir dizine kopyalar, yalnizca
# yerelde cozulemeyen iki seyi ikame eder ve orada test eder.
#
# NEDEN VAR: 2026-08-30'a kadar deploy nginx/conf.d dizinini sunucuya HIC
# gondermiyordu, o yuzden konfig bozulsa da kimse gormuyordu -- repodaki kopya
# ile sunucudaki ayri yasiyordu. Artik gonderiliyor (.github/workflows/ci.yml),
# yani bozuk bir konfig deploy ile CANLIYA gidebilir ve nginx acilmazsa SITE
# KAPANIR. Bu script o riskin karsiligi: bozuk konfig S3'e hic ulasmasin diye
# CI'da `verify` isinde kosar.
#
# IKAME EDILEN IKI SEY (ve nedeni):
#   1. TLS sertifika yollari -- /etc/ssl/cloudflare/* yalnizca sunucuda var;
#      `nginx -t` dosyayi gercekten acmaya calisir. Yerine gecici self-signed.
#   2. `upstream server web:3000` -- `web` yalnizca compose aginda cozulur;
#      nginx upstream host adini konfig ayristirirken cozer. Yerine 127.0.0.1.
# Bunlarin disinda HICBIR satir degistirilmez: limit_req, location onceligi,
# proxy basliklari, header'lar hepsi oldugu gibi sinanir.
#
# SURUM TUZAGI -- BU SCRIPTIN ILK KOSUSUNDA ISIRDI:
# Dogrulama URETIMIN KOSTURDUGU nginx surumuyle yapilmali. Ilk surum CI'da
# `apt-get install nginx-core` diyordu; Ubuntu 24.04 bunun 1.24.0'ini veriyor ve
# 1.24 `http2 on;` direktifini TANIMIYOR (ayri direktif olarak 1.25.1'de geldi;
# 1.24'te `listen 443 ssl http2;` yazilir). Uretim `nginx:1.27-alpine` kosuyor ve
# direktif orada gecerli -- yani kapi DOGRU bir konfigi reddetti. Yanlis negatif
# ureten bir kapi hic olmayandan kotudur: insanlara onu baypas etmeyi ogretir.
# Bu yuzden imaj docker-compose.yml'den OKUNUR, elle yazilmaz.
#
# HICBIR SEY DEGISTIRMEZ. Basarisizlikta non-zero doner.
# ============================================================

set -e

readonly SCRIPT_NAME="$(basename "$0")"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEFAULT_CONF_DIR="$REPO_ROOT/nginx/conf.d"
readonly COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

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
  echo "nginx/conf.d/*.conf dosyalarini 'nginx -t' ile dogrular. Repoyu degistirmez."
  echo
  echo "Secenekler:"
  echo -e "  --conf-dir\tDogrulanacak dizin. Varsayilan: nginx/conf.d"
  echo -e "  --engine\tdocker | local | auto. Varsayilan: auto"
  echo -e "\t\tdocker = docker-compose.yml'deki nginx imaji (URETIMLE AYNI SURUM)"
  echo -e "\t\tlocal  = PATH'teki nginx binary'si; surum farkliysa UYARIR"
  echo -e "  --help\t\tBu metni gosterir"
  echo
  echo "Cikis kodu: 0 = konfig gecerli, 1 = gecersiz ya da on kosul eksik."
  echo
  echo "Gereksinimler: openssl, artı docker YA DA nginx (brew install nginx)."
  echo
}

function assert_is_installed() {
  local -r name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    log_error "'$name' kurulu degil, gerekli"
    return 1
  fi
}

# nginx binary'sini bul. Debian/Ubuntu (CI runner) onu /usr/sbin'e koyar ve o dizin
# root olmayan kullanicinin PATH'inde OLMAYABILIR -- yalnizca `command -v nginx`e
# bakan bir kontrol CI'da "kurulu degil" der, oysa kuruludur.
function resolve_nginx() {
  if command -v nginx >/dev/null 2>&1; then
    command -v nginx
    return 0
  fi
  local candidate
  for candidate in /usr/sbin/nginx /usr/local/sbin/nginx /opt/homebrew/bin/nginx; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# Uretimin nginx imajini docker-compose.yml'den okur. Elle yazilan bir surum
# compose'dakiyle sessizce ayrisir; tek kaynak compose dosyasidir.
function prod_nginx_image() {
  local image
  image="$(grep -oE 'image: *nginx:[^ ]+' "$COMPOSE_FILE" | head -1 | sed 's/image: *//')"
  if [[ -z "$image" ]]; then
    log_error "docker-compose.yml icinde 'image: nginx:...' bulunamadi"
    return 1
  fi
  echo "$image"
}

function docker_is_usable() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

function main() {
  local conf_dir="$DEFAULT_CONF_DIR"
  local engine_pref="auto"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --conf-dir) conf_dir="$2"; shift 2 ;;
      --engine)   engine_pref="$2"; shift 2 ;;
      --help)     print_usage; exit 0 ;;
      *)          log_error "Bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  case "$engine_pref" in
    auto|docker|local) ;;
    *) log_error "--engine yalnizca auto|docker|local olabilir (verilen: $engine_pref)"; return 1 ;;
  esac

  assert_is_installed "openssl"

  if [[ ! -d "$conf_dir" ]]; then
    log_error "Dizin yok: $conf_dir"
    return 1
  fi

  # `local x=$(cmd)` cmd'nin cikis kodunu MASKELER (donen sey `local`in kodudur,
  # yani 0). Bu yuzden tanim ve atama ayri satirda.
  local prod_image
  prod_image="$(prod_nginx_image)" || return 1

  # Motor secimi. Tercih docker: uretimin imajiyla dogrulamak, "gecerli mi"
  # sorusunun TEK dogru cevabidir -- yerel binary baska bir surum olabilir ve
  # dogru bir konfigi reddedebilir (bkz. bastaki SURUM TUZAGI notu).
  local engine="" nginx_bin=""
  if [[ "$engine_pref" != "local" ]] && docker_is_usable; then
    engine="docker"
  elif [[ "$engine_pref" == "docker" ]]; then
    log_error "--engine docker istendi ama docker calismiyor"
    return 1
  else
    engine="local"
    nginx_bin="$(resolve_nginx)" || {
      log_error "Ne docker ne de nginx bulunabildi."
      log_error "  macOS : brew install nginx   (ya da Docker Desktop'i baslat)"
      log_error "  Linux : sudo apt-get install -y nginx-core"
      return 1
    }
  fi

  local -r work="$(mktemp -d)"
  # `set -e` altinda bile temizlensin diye trap; mktemp -d dizini bizimdir.
  trap 'rm -rf "$work"' EXIT

  mkdir -p "$work/conf.d" "$work/logs" "$work/html"
  cp "$conf_dir"/*.conf "$work/conf.d/"

  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$work/test.key" -out "$work/test.crt" -days 1 \
    -subj "/CN=bagajpark.com" >/dev/null 2>&1

  # Ikameler. sed'in -i bicimi BSD (macOS) ile GNU (CI, Linux) arasinda
  # ayrisiyor; gecici kopya uzerinde calistigimiz icin -i yerine dosyayi
  # bastan yaziyoruz -- iki platformda da ayni davranir.
  local f tmp
  for f in "$work"/conf.d/*.conf; do
    tmp="$(mktemp)"
    sed -e "s|/etc/ssl/cloudflare/bagajpark.crt|$work/test.crt|g" \
        -e "s|/etc/ssl/cloudflare/bagajpark.key|$work/test.key|g" \
        -e "s|server web:3000;|server 127.0.0.1:3000;|g" \
        "$f" > "$tmp"
    mv "$tmp" "$f"
  done

  # error_log / pid / temp yollari ACIKCA gecici dizine bakar. Varsayilanlari
  # /var/log/nginx ve /var/run'dir; root olmayan bir kullanici (CI runner) oralara
  # yazamaz ve `nginx -t` konfig yuzunden DEGIL izin yuzunden duser -- yani gecerli
  # bir konfig gecersiz gorunur.
  cat > "$work/nginx.conf" <<EOF
error_log $work/logs/error.log;
pid $work/nginx.pid;
events { worker_connections 1024; }
http {
    access_log $work/logs/access.log;
    client_body_temp_path $work/client_body;
    proxy_temp_path $work/proxy;
    fastcgi_temp_path $work/fastcgi;
    uwsgi_temp_path $work/uwsgi;
    scgi_temp_path $work/scgi;
    include $work/conf.d/*.conf;
}
EOF

  log_info "Dogrulaniyor: $conf_dir ($(ls -1 "$conf_dir"/*.conf | wc -l | tr -d ' ') dosya)"

  local ok="false"
  if [[ "$engine" == "docker" ]]; then
    log_info "Motor: docker, imaj $prod_image (uretimle AYNI surum)"
    # $work konteynerde AYNI yola baglanir; uretilen nginx.conf mutlak yollar
    # tasiyor, yoksa include ve sertifika yollari cozulmez. rw: `nginx -t`
    # temp dizinlerini olusturmaya calisir.
    if docker run --rm -v "$work:$work" "$prod_image" \
         nginx -t -p "$work" -c "$work/nginx.conf"; then
      ok="true"
    fi
  else
    local local_ver prod_ver
    local_ver="$("$nginx_bin" -v 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)"
    prod_ver="$(echo "$prod_image" | grep -oE '[0-9]+\.[0-9]+' | head -1)"
    log_info "Motor: yerel binary $nginx_bin ($("$nginx_bin" -v 2>&1))"
    if [[ "$local_ver" != "$prod_ver" ]]; then
      log_warn "Yerel nginx $local_ver, uretim $prod_ver -- SURUMLER FARKLI."
      log_warn "Bir direktif surumler arasinda gelmis/gitmis olabilir (ornek:"
      log_warn "\`http2 on;\` 1.25.1'de geldi). Kesin cevap icin: --engine docker"
    fi
    if "$nginx_bin" -t -p "$work" -c "$work/nginx.conf"; then
      ok="true"
    fi
  fi

  if [[ "$ok" == "true" ]]; then
    log_info "Konfig gecerli."
    return 0
  fi

  log_error "Konfig GECERSIZ. Yukaridaki nginx ciktisi satiri gosterir."
  log_error "Deploy bunu canliya goturur ve nginx acilmazsa site kapanir."
  return 1
}

main "$@"
