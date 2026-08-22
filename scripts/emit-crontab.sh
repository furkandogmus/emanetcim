#!/bin/bash
# ============================================================
# BagajPark - Kayit defterinden crontab satirlari uret
# ============================================================
# src/lib/jobs/registry.ts TEK KAYNAKTIR. Bu script oradaki tanimlari okuyup
# yapistirilabilir crontab satirlarina cevirir.
#
# NEDEN: is tanimlari uc ayri yere dagilmisti ve hicbiri digerini bilmiyordu.
# Slot uretimi 37 gun durdu, odeme mutabakat cron'u 2 ay boyunca 404 aldi --
# ikisi de kimse fark etmeden (P1-11). Crontab'i elle yazmak, kayit defteriyle
# gercegin ayrilmasinin ta kendisidir.
#
# HICBIR SEY DEGISTIRMEZ. Yalnizca stdout'a yazar; crontab'a ekleme kararini
# operator verir.
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_APP_DIR="/root/emanetci"

function log() {
  >&2 echo -e "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"
}

function log_info()  { log "INFO  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME [SECENEKLER]"
  echo
  echo "src/lib/jobs/registry.ts icindeki is tanimlarindan crontab satirlari uretir."
  echo "Hicbir sey degistirmez -- ciktiyi siz crontab'a eklersiniz."
  echo
  echo "Secenekler:"
  echo -e "  --app-dir\tSunucudaki uygulama dizini. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --only-enforced\tYalnizca enforced=true isleri yaz"
  echo -e "  --help\t\tBu metni gosterir"
  echo
  echo "Ornek:"
  echo "  $SCRIPT_NAME                     # tum isler"
  echo "  $SCRIPT_NAME | crontab -         # DIKKAT: mevcut crontab'i EZER"
  echo
}

function assert_is_installed() {
  local -r name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    log_error "'$name' kurulu degil, gerekli"
    exit 1
  fi
}

function main() {
  local app_dir="$DEFAULT_APP_DIR"
  local only_enforced="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --app-dir)       app_dir="$2";        shift 2 ;;
      --only-enforced) only_enforced="true"; shift ;;
      --help)          print_usage; exit 0 ;;
      *)
        log_error "Bilinmeyen secenek: $1"
        print_usage
        exit 1
        ;;
    esac
  done

  assert_is_installed "npx"

  local -r repo_root="$(cd "$(dirname "$0")/.." && pwd)"
  log_info "Kayit defteri okunuyor: src/lib/jobs/registry.ts"

  APP_DIR="$app_dir" ONLY_ENFORCED="$only_enforced" \
    npx tsx --eval "
      import { JOB_REGISTRY } from './src/lib/jobs/registry';
      const appDir = process.env.APP_DIR;
      const onlyEnforced = process.env.ONLY_ENFORCED === 'true';
      const jobs = JOB_REGISTRY.filter(j => !onlyEnforced || j.enforced);
      console.log('# BagajPark zamanlanmis isler');
      console.log('# URETILDI: scripts/emit-crontab.sh -- ELLE DUZENLEMEYIN.');
      console.log('# Kaynak: src/lib/jobs/registry.ts');
      console.log('');
      for (const j of jobs) {
        const script = j.script
          ? \`\${appDir}/\${j.script}\`
          : \`\${appDir}/scripts/call-internal-job.sh --job \${j.name}\`;
        console.log(\`# \${j.what}\`);
        console.log(\`# Calismazsa: \${j.ifItStops}\`);
        if (!j.enforced) {
          console.log('# NOT: enforced=false -- gecikmesi saglik kontrolunu DEGRADED yapmaz.');
          console.log('#       Cron kurulduktan sonra registry.ts icinde true yapin.');
        }
        console.log(\`\${j.cron} \${script} >> /var/log/bagajpark-\${j.name}.log 2>&1\`);
        console.log('');
      }
    " 2>/dev/null || {
      log_error "Kayit defteri okunamadi. Repo kokunde ve bagimliliklar kurulu mu?"
      log_error "  cd $repo_root && npm install"
      return 1
    }

  log_info "Bitti. Ciktiyi gozden gecirip crontab'a EKLEYIN (uzerine yazmayin):"
  log_info "  crontab -l > /tmp/cron.bak && (crontab -l; $SCRIPT_NAME) | crontab -"
  return 0
}

main "$@"
