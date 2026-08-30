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
# HICBIR SEY DEGISTIRMEZ. Basarisizlikta non-zero doner.
# ============================================================

set -e

readonly SCRIPT_NAME="$(basename "$0")"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DEFAULT_CONF_DIR="$REPO_ROOT/nginx/conf.d"

function log() {
  >&2 echo -e "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"
}

function log_info()  { log "INFO  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME [SECENEKLER]"
  echo
  echo "nginx/conf.d/*.conf dosyalarini 'nginx -t' ile dogrular. Repoyu degistirmez."
  echo
  echo "Secenekler:"
  echo -e "  --conf-dir\tDogrulanacak dizin. Varsayilan: nginx/conf.d"
  echo -e "  --help\t\tBu metni gosterir"
  echo
  echo "Cikis kodu: 0 = konfig gecerli, 1 = gecersiz ya da on kosul eksik."
  echo
  echo "Gereksinimler: nginx, openssl. nginx yoksa: brew install nginx"
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

function main() {
  local conf_dir="$DEFAULT_CONF_DIR"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --conf-dir) conf_dir="$2"; shift 2 ;;
      --help)     print_usage; exit 0 ;;
      *)          log_error "Bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  assert_is_installed "openssl"

  # `local x=$(cmd)` cmd'nin cikis kodunu MASKELER (donen sey `local`in kodudur,
  # yani 0). Bu yuzden tanim ve atama ayri satirda.
  local nginx_bin
  nginx_bin="$(resolve_nginx)" || {
    log_error "nginx bulunamadi (PATH ve /usr/sbin, /usr/local/sbin, /opt/homebrew/bin bakildi)"
    log_error "  macOS : brew install nginx"
    log_error "  Linux : sudo apt-get install -y nginx-core"
    return 1
  }

  if [[ ! -d "$conf_dir" ]]; then
    log_error "Dizin yok: $conf_dir"
    return 1
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
  log_info "nginx: $nginx_bin ($("$nginx_bin" -v 2>&1))"

  # `nginx -t` ciktisi stderr'e gider; hem gosterip hem cikis kodunu korumak
  # icin pipe KULLANILMIYOR -- `set -e` pipefail olmadan pipeline'in son
  # komutunun kodunu dondururdu ve hata yutulurdu.
  if "$nginx_bin" -t -p "$work" -c "$work/nginx.conf"; then
    log_info "Konfig gecerli."
    return 0
  fi

  log_error "Konfig GECERSIZ. Yukaridaki nginx ciktisi satiri gosterir."
  log_error "Deploy bunu canliya goturur ve nginx acilmazsa site kapanir."
  return 1
}

main "$@"
