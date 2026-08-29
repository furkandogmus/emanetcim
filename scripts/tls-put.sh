#!/bin/bash
# ============================================================
# BagajPark - Canli TLS materyalini Parameter Store'a tasir
# ============================================================
# /etc/ssl/cloudflare altindaki sertifika ve OZEL ANAHTARI SSM'e SecureString
# olarak yazar.
#
# NEDEN: 2026-08-29'da su tablo cikti --
#   Parameter Store'daki sertifika : SAN = aws-test.bagajpark.com
#   nginx'in servis ettigi         : SAN = bagajpark.com, *.bagajpark.com
# Yani TLS materyali Parameter Store'daydi ama YANLIS olani. Canli sertifika
# ve anahtari yalnizca sunucunun diskinde, tek kopya duruyordu -- uygulama
# sirlarinin tasinmadan onceki hali. Stack yeniden kurulursa (EIP degisimi,
# bolge degisimi, felaket kurtarma) yeni instance sertifikayi bulamaz ve
# SITE ACILMAZ. (DEFECT_BACKLOG madde 5.)
#
# `aws-test.bagajpark.com` alan adinin DNS kaydi YOK, yani SSM'deki sertifika
# var olmayan bir alan adina ait; uzerine yazmak bir seyi kirmaz.
#
# BU SCRIPT SUNUCUDA CALISIR. Sebebi ozel anahtar: kutuda kalir, hicbir
# laptop'a inmez ve hicbir SSM komut ciktisina dusmez. Ekrana yalnizca
# sertifikanin SAN'i ve dosya uzunluklari basilir -- anahtar ASLA.
#
# Instance rolunun bu oneke PutParameter izni `enable_secret_seeding` ile
# GECICI acilir; is bitince KAPATILIR (bkz. ops/SECRETS.md).
#
# VARSAYILAN KURU CALISMADIR. Yazmak icin `--apply` gerekir.
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_CERT="/etc/ssl/cloudflare/bagajpark.crt"
readonly DEFAULT_KEY="/etc/ssl/cloudflare/bagajpark.key"
readonly DEFAULT_PREFIX="/bagajpark/aws-test/tls"
readonly DEFAULT_REGION="eu-central-1"

function log()       { >&2 echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"; }
function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME [SECENEKLER]"
  echo
  echo "Canli TLS sertifikasi ve ozel anahtarini SSM'e SecureString yazar."
  echo "Varsayilan KURU KOSU."
  echo
  echo "Secenekler:"
  echo -e "  --cert\tSertifika dosyasi. Varsayilan: $DEFAULT_CERT"
  echo -e "  --key\t\tOzel anahtar dosyasi. Varsayilan: $DEFAULT_KEY"
  echo -e "  --prefix\tSSM onek yolu. Varsayilan: $DEFAULT_PREFIX"
  echo -e "  --region\tAWS bolgesi. Varsayilan: $DEFAULT_REGION"
  echo -e "  --apply\tGercekten yaz."
  echo -e "  --help\tBu yardim."
  echo
}

function assert_is_installed() {
  local -r bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    log_error "'$bin' kurulu degil."; exit 1
  fi
}

# Deger argv'ye DUSMEZ: 600 izinli gecici bir JSON dosyasindan okunur, boylece
# `ps` ciktisinda gorunmez. Ayni desen scripts/secrets-put.sh'ta da kullaniliyor.
function put_param() {
  local -r name="$1"; local -r file="$2"
  local tmp
  tmp=$(mktemp); chmod 600 "$tmp"
  if ! python3 - "$name" "$file" "$tmp" <<'PY'
import json, sys
name, src, out = sys.argv[1:4]
with open(src, encoding="utf-8") as f:
    value = f.read()
if not value.strip():
    sys.exit(3)
json.dump({"Name": name, "Value": value, "Type": "SecureString", "Overwrite": True},
          open(out, "w", encoding="utf-8"))
PY
  then
    rm -f "$tmp"; log_error "$name: dosya okunamadi veya bos"; return 1
  fi
  if ! aws ssm put-parameter --region "$REGION" --cli-input-json "file://$tmp" >/dev/null; then
    rm -f "$tmp"; log_error "$name: SSM yazimi basarisiz"; return 1
  fi
  rm -f "$tmp"
}

function main() {
  local cert="$DEFAULT_CERT"
  local key="$DEFAULT_KEY"
  local prefix="$DEFAULT_PREFIX"
  local apply="false"
  REGION="$DEFAULT_REGION"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --cert)   cert="$2"; shift 2 ;;
      --key)    key="$2"; shift 2 ;;
      --prefix) prefix="$2"; shift 2 ;;
      --region) REGION="$2"; shift 2 ;;
      --apply)  apply="true"; shift ;;
      --help)   print_usage; exit 0 ;;
      *)        log_error "Bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  assert_is_installed "aws"
  assert_is_installed "openssl"
  assert_is_installed "python3"

  for f in "$cert" "$key"; do
    if [[ ! -r "$f" ]]; then log_error "okunamiyor: $f"; exit 1; fi
  done

  # Sertifika ile anahtarin AYNI cifte ait oldugunu dogrula. Eslesmeyen bir cifti
  # yazmak, yeni instance'i sertifikasi acilmayan bir nginx ile ayaga kaldirir --
  # tam da kapatmaya calistigimiz hata.
  local cert_mod key_mod
  cert_mod=$(openssl x509 -noout -modulus -in "$cert" | openssl md5)
  key_mod=$(openssl rsa -noout -modulus -in "$key" | openssl md5)
  if [[ "$cert_mod" != "$key_mod" ]]; then
    log_error "sertifika ve ozel anahtar AYNI cifte ait degil. Yazilmadi."
    exit 1
  fi
  log_info "sertifika/anahtar cifti eslesiyor"

  # SAN'i goster: hangi alan adini yazdigimiz kayda gecsin.
  log_info "sertifika kimligi:"
  openssl x509 -in "$cert" -noout -subject -dates -ext subjectAltName 2>/dev/null | sed 's/^/    /' >&2

  local -r not_after=$(openssl x509 -in "$cert" -noout -enddate | cut -d= -f2)
  log_info "gecerlilik sonu: $not_after"
  log_info "boyutlar: cert=$(wc -c < "$cert") bayt, key=$(wc -c < "$key") bayt"

  if [[ "$apply" != "true" ]]; then
    log_warn "KURU KOSU -- hicbir sey yazilmadi. Yazmak icin --apply ekleyin."
    log_warn "  Yazilacak: ${prefix}/cert ve ${prefix}/key"
    return 0
  fi

  put_param "${prefix}/cert" "$cert"
  log_info "yazildi ${prefix}/cert"
  put_param "${prefix}/key" "$key"
  log_info "yazildi ${prefix}/key"

  # Dogrulama: yazilan SERTIFIKAYI geri okuyup SAN'ini karsilastir. Anahtar
  # geri OKUNMAZ -- dogrulamak icin ona ihtiyac yok ve okumak gereksiz risk.
  local written_san
  written_san=$(aws ssm get-parameter --region "$REGION" --name "${prefix}/cert" \
    --with-decryption --query Parameter.Value --output text \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null | tail -1 | tr -d ' ')
  local local_san
  local_san=$(openssl x509 -in "$cert" -noout -ext subjectAltName 2>/dev/null | tail -1 | tr -d ' ')
  if [[ "$written_san" != "$local_san" ]]; then
    log_error "geri okunan sertifikanin SAN'i farkli. Beklenen: $local_san, gelen: $written_san"
    exit 1
  fi
  log_info "dogrulandi: SSM'deki sertifikanin SAN'i $written_san"
}

main "$@"
