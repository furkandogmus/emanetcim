#!/bin/bash
# SSM Parameter Store'daki anahtarlardan docker-compose.env uretir.
#
# NEDEN: deploy bugun env dosyasina hic dokunmuyor -- dosya yalnizca sunucunun
# diskinde yasiyor. Yeni bir instance env'siz aciliyor ve docker-compose.yml'de
# HER degiskenin bir varsayilani oldugu icin uygulama sessizce yanlis degerlerle
# degil, ama eksik yapilandirmayla acilabiliyor. Bu script tek dogruluk
# kaynagini Parameter Store yapar.
#
# BU SCRIPT SUNUCUDA CALISIR. Ekrana hicbir DEGER basmaz, yalnizca anahtar sayisi.
set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_OUT="/opt/emanetci/docker-compose.env"
readonly DEFAULT_MANIFEST="/opt/emanetci/secrets.manifest"
# Uretilen dosyanin sahibi/grubu ve izni.
#
# NEDEN 600 DEGIL: cron isleri `ec2-user` olarak kosuyor ve CRON_SECRET'i bu
# dosyadan okuyor (call-internal-job.sh). 600/root birakilinca sekiz zamanlanmis
# isin tamami "CRON_SECRET tanimli degil" ile SESSIZCE duser -- 2026-08-29'da
# duman testinde tam olarak bu yasandi.
#
# Ve 640 bir taviz DEGIL: ec2-user zaten `docker compose exec web printenv` ile
# butun sirlari gorebiliyor. Dosyayi ondan saklamak hicbir seyi korumuyordu,
# yalnizca cron'u kiriyordu. Dosya diger kullanicilara kapali kalmaya devam eder.
readonly DEFAULT_FILE_GROUP="ec2-user"
readonly FILE_MODE="640"

function log()       { >&2 echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"; }
function log_info()  { log "INFO  $*"; }
function log_warn()  { log "WARN  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME --prefix </bagajpark/env/app> [SECENEKLER]"
  echo
  echo "<prefix> altindaki tum parametreleri cozup KEY=deger dosyasi yazar."
  echo "Dosya once gecici olarak 600 izinle yazilir, dogrulanir, sonra tasinir --"
  echo "yarim yazilmis bir env dosyasi uretime cikmaz."
  echo
  echo "Secenekler:"
  echo -e "  --prefix\tSSM onek yolu. ZORUNLU."
  echo -e "  --out\t\tHedef dosya. Varsayilan: $DEFAULT_OUT"
  echo -e "  --manifest\tZorunlu anahtar listesi. Varsayilan: $DEFAULT_MANIFEST"
  echo -e "  --group\tDosya grubu. Varsayilan: $DEFAULT_FILE_GROUP (cron kullanicisi)"
  echo -e "\t\t(yoksa atlanir; varsa eksik anahtarda script KIRAR)"
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

function main() {
  local prefix=""
  local out="$DEFAULT_OUT"
  local manifest="$DEFAULT_MANIFEST"
  local file_group="$DEFAULT_FILE_GROUP"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prefix)   prefix="$2"; shift 2 ;;
      --out)      out="$2"; shift 2 ;;
      --manifest) manifest="$2"; shift 2 ;;
      --group)    file_group="$2"; shift 2 ;;
      --help)     print_usage; exit 0 ;;
      *)          log_error "bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  assert_not_empty "--prefix" "$prefix"
  assert_is_installed "aws"
  assert_is_installed "python3"

  local raw
  raw=$(mktemp); chmod 600 "$raw"
  local tmp
  tmp=$(mktemp); chmod 600 "$tmp"
  # `set -e` altinda bile gecici dosyalar sizmasin.
  trap 'rm -f "$raw" "$tmp"' EXIT

  # Cikis kodu ayri satirda kontrol ediliyor: `local x=$(...)` atamasi komutun
  # degil `local`in kodunu dondurur ve hatayi yutar.
  if ! aws ssm get-parameters-by-path \
        --path "$prefix" --with-decryption --recursive \
        --output json > "$raw"; then
    log_error "SSM okunamadi ($prefix). Mevcut $out DEGISTIRILMEDI."
    exit 1
  fi

  local written
  if ! written=$(python3 - "$raw" "$tmp" "$prefix" <<'PY'
import json, sys
raw, out, prefix = sys.argv[1:4]
params = json.load(open(raw, encoding="utf-8")).get("Parameters", [])
rows = []
for p in params:
    key = p["Name"].rsplit("/", 1)[-1]
    val = p["Value"]
    # Cok satirli bir deger env dosyasini bozar; boyle bir sey buraya
    # hic girmemeli, bu yuzden sessizce kirpmak yerine kiriyoruz.
    if "\n" in val or "\r" in val:
        sys.stderr.write(f"cok satirli deger env dosyasina yazilamaz: {key}\n")
        sys.exit(4)
    rows.append((key, val))
rows.sort()
with open(out, "w", encoding="utf-8") as f:
    f.write("# Bu dosya scripts/secrets-render.sh tarafindan uretildi.\n")
    f.write(f"# Kaynak: SSM Parameter Store {prefix}\n")
    f.write("# ELLE DUZENLEMEYIN -- bir sonraki deploy uzerine yazar.\n")
    for k, v in rows:
        f.write(f"{k}={v}\n")
print(len(rows))
PY
  ); then
    log_error "parametreler yazilamadi. Mevcut $out DEGISTIRILMEDI."
    exit 1
  fi

  # SSM bos donerse (yanlis prefix, silinmis parametreler, IAM daralmasi)
  # canli env dosyasini bosaltmak uretimi indirir. Boyle bir durumda dokunma.
  if [ "$written" -eq 0 ]; then
    log_error "$prefix altinda hic parametre yok. Mevcut $out DEGISTIRILMEDI."
    exit 1
  fi

  if [ -r "$manifest" ]; then
    local missing=""
    while IFS= read -r key; do
      key="${key%%#*}"; key="$(echo "$key" | tr -d '[:space:]')"
      [ -z "$key" ] && continue
      if ! grep -q "^${key}=" "$tmp"; then
        missing="$missing $key"
      fi
    done < "$manifest"
    if [ -n "$missing" ]; then
      log_error "manifest'teki anahtarlar Parameter Store'da yok:$missing"
      log_error "Mevcut $out DEGISTIRILMEDI."
      exit 1
    fi
    log_info "manifest dogrulandi ($manifest)"
  else
    log_warn "manifest yok ($manifest) -- zorunlu anahtar kontrolu ATLANDI."
  fi

  # Ayni dosya sistemi icinde tasima atomiktir: yarim dosya asla gorunmez.
  local -r dir="$(dirname "$out")"
  local final
  final=$(mktemp "$dir/.docker-compose.env.XXXXXX")
  cat "$tmp" > "$final"
  # Grup once, izin sonra: ters sirada dosya kisa bir an grup-okunabilir olur.
  if ! chgrp "$file_group" "$final" 2>/dev/null; then
    log_warn "grup '$file_group' atanamadi; cron bu dosyayi okuyamayabilir."
  fi
  chmod "$FILE_MODE" "$final"
  mv -f "$final" "$out"
  log_info "$out yazildi: $written anahtar ($prefix), izin $FILE_MODE grup $file_group"
}

main "$@"
