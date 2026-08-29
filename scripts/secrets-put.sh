#!/bin/bash
# docker-compose.env icindeki her anahtari SSM Parameter Store'a SecureString yazar.
#
# NEDEN: uretim sirlari tek EC2'nun diskinde, tek kopya, yedeksiz duruyordu
# (deploy dosyaya dokunmuyor, backup.sh onu yedeklemiyor). Instance giderse
# AUTH_SECRET, POSTGRES_PASSWORD, RESEND_API_KEY, NETGSM_PASSWORD gider.
#
# BU SCRIPT SUNUCUDA CALISIR (SSM Run Command ile; bkz. scripts/secrets-remote.sh).
# Sebebi: degerler boylece laptop'a, shell gecmisine ve SSM komut ciktisina hic
# inmez. Ekrana yalnizca ANAHTAR ADLARI basilir, hicbir deger basilmaz.
set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_ENV_FILE="/opt/emanetci/docker-compose.env"

function log()       { >&2 echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"; }
function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME --prefix </bagajpark/env/app> [SECENEKLER]"
  echo
  echo "env dosyasindaki her KEY=deger ciftini <prefix>/KEY adiyla SecureString"
  echo "olarak yazar. Varsayilan KURU KOSU -- yazmak icin --apply gerekir."
  echo
  echo "Secenekler:"
  echo -e "  --prefix\tSSM onek yolu (bas ve son slash'siz govde). ZORUNLU."
  echo -e "  --env-file\tKaynak dosya. Varsayilan: $DEFAULT_ENV_FILE"
  echo -e "  --apply\tGercekten yaz. Yoksa yalnizca ne yazilacagini listeler."
  echo -e "  --help\tBu yardim."
  echo
}

function assert_not_empty() {
  local -r name="$1"; local -r value="$2"
  if [ -z "$value" ]; then
    log_error "'$name' bos olamaz."; print_usage; exit 1
  fi
}

function assert_is_installed() {
  local -r bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    log_error "'$bin' kurulu degil."; exit 1
  fi
}

# env dosyasindan "ANAHTAR<TAB>bos_mu" satirlari okur. Deger DONDURMEZ --
# degerler yalnizca python3 icinde kalir ve dogrudan --cli-input-json
# dosyasina yazilir.
function read_keys() {
  local -r env_file="$1"
  python3 - "$env_file" <<'PY'
import sys, re
path = sys.argv[1]
for line in open(path, encoding="utf-8"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    k, v = k.strip(), v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
        v = v[1:-1]
    if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", k):
        print(f"{k}\t{'1' if v == '' else '0'}")
PY
}

# Tek bir anahtari yazar. Deger argv'ye DUSMEZ: 600 izinli gecici bir JSON
# dosyasina yazilir ve aws ssm --cli-input-json ile okunur ("ps" ile gorulemez).
function put_one() {
  local -r env_file="$1"; local -r key="$2"; local -r name="$3"
  local tmp
  tmp=$(mktemp); chmod 600 "$tmp"
  if ! python3 - "$env_file" "$key" "$name" "$tmp" <<'PY'
import json, sys
env_path, key, name, out = sys.argv[1:5]
val = None
for line in open(env_path, encoding="utf-8"):
    s = line.strip()
    if not s or s.startswith("#") or "=" not in s:
        continue
    k, v = s.split("=", 1)
    if k.strip() == key:
        v = v.strip()
        # docker compose env dosyalarinda tirnak opsiyonel; varsa soyulur.
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
            v = v[1:-1]
        val = v
if val is None:
    sys.exit(3)
json.dump({"Name": name, "Value": val, "Type": "SecureString", "Overwrite": True},
          open(out, "w", encoding="utf-8"))
PY
  then
    rm -f "$tmp"; log_error "$key: deger okunamadi"; return 1
  fi
  if ! aws ssm put-parameter --cli-input-json "file://$tmp" >/dev/null; then
    rm -f "$tmp"; log_error "$key: SSM yazimi basarisiz"; return 1
  fi
  rm -f "$tmp"
}

function main() {
  local prefix=""
  local env_file="$DEFAULT_ENV_FILE"
  local apply="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prefix)   prefix="$2"; shift 2 ;;
      --env-file) env_file="$2"; shift 2 ;;
      --apply)    apply="true"; shift ;;
      --help)     print_usage; exit 0 ;;
      *)          log_error "bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  assert_not_empty "--prefix" "$prefix"
  assert_is_installed "aws"
  assert_is_installed "python3"

  if [ ! -r "$env_file" ]; then
    log_error "env dosyasi okunamiyor: $env_file"; exit 1
  fi

  local keys
  keys=$(read_keys "$env_file")
  if [ -z "$keys" ]; then
    log_error "$env_file icinde KEY=deger satiri yok -- yanlis dosya olabilir."; exit 1
  fi

  local count=0 failed=0 skipped=0
  while IFS=$'\t' read -r key is_empty; do
    [ -z "$key" ] && continue
    # SecureString bos deger kabul etmez. Bos birakilmis anahtar zaten
    # docker-compose.yml'deki `${KEY:-}` varsayilaniyla ayni sonucu verir,
    # o yuzden atlamak davranisi degistirmez.
    if [ "$is_empty" = "1" ]; then
      log_warn "atlandi (bos deger): $key"
      skipped=$((skipped + 1)); continue
    fi
    local name="${prefix%/}/$key"
    if [ "$apply" != "true" ]; then
      log_info "[kuru] $name"
    elif put_one "$env_file" "$key" "$name"; then
      log_info "yazildi $name"
    else
      failed=$((failed + 1)); continue
    fi
    count=$((count + 1))
  done <<< "$keys"

  if [ "$failed" -gt 0 ]; then
    log_error "$failed anahtar yazilamadi."; exit 1
  fi
  if [ "$apply" != "true" ]; then
    log_warn "KURU KOSU -- hicbir sey yazilmadi. Yazmak icin --apply ekleyin."
  fi
  log_info "tamam: $count anahtar yazildi, $skipped bos anahtar atlandi ($prefix)"
}

main "$@"
