#!/bin/bash
# Sunucudaki secret islemlerini SSM Run Command ile tetikler. SSH/SCP YOK.
#
# NEDEN: "prod'dan cek, depoya ekle" akisi uretim sirlarini laptop diskinden
# ve shell gecmisinden gecirir. Burada butun is kutuda olur; bu script
# yalnizca komutu gonderir ve ANAHTAR ADLARINDAN ibaret ciktiyi gosterir.
# Hicbir komut deger basmaz -- SSM komut ciktisi CloudTrail/SSM gecmisinde
# saklandigi icin bu bir tercih degil, zorunluluk.
set -e

readonly SCRIPT_NAME="$(basename "$0")"
readonly DEFAULT_TAG_KEY="tag:Project"
readonly DEFAULT_TAG_VALUE="bagajpark-aws-test"
readonly DEFAULT_APP_DIR="/opt/emanetci"
readonly DEFAULT_PREFIX="/bagajpark/env/app"

function log()       { >&2 echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$SCRIPT_NAME] $*"; }
function log_info()  { log "INFO  $*"; }
function log_error() { log "ERROR $*"; }

function print_usage() {
  echo
  echo "Kullanim: $SCRIPT_NAME <komut> [SECENEKLER]"
  echo
  echo "Komutlar:"
  echo -e "  keys\t\tSunucudaki docker-compose.env icindeki ANAHTAR ADLARINI listeler."
  echo -e "\t\tDeger basmaz. Manifest'i dogrulamak icin ilk adim budur."
  echo -e "  seed-dry\tEnv dosyasindan Parameter Store'a ne yazilacagini gosterir (yazmaz)."
  echo -e "  seed\t\tEnv dosyasindaki anahtarlari Parameter Store'a SecureString yazar."
  echo -e "  render\tParameter Store'dan docker-compose.env uretir (manifest dogrular)."
  echo -e "  diff\t\tSunucudaki dosya ile Parameter Store ayni anahtarlari mi tasiyor?"
  echo
  echo "Secenekler:"
  echo -e "  --prefix\tSSM onek yolu. Varsayilan: $DEFAULT_PREFIX"
  echo -e "  --app-dir\tSunucudaki uygulama dizini. Varsayilan: $DEFAULT_APP_DIR"
  echo -e "  --tag-value\tHedef instance Project etiketi. Varsayilan: $DEFAULT_TAG_VALUE"
  echo -e "  --profile\tAWS profili. Varsayilan: ortam degiskenlerinden."
  echo -e "  --region\tAWS bolgesi. Varsayilan: profilden."
  echo -e "  --help\tBu yardim."
  echo
}

function assert_is_installed() {
  local -r bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    log_error "'$bin' kurulu degil."; exit 1
  fi
}

# Verilen kabuk komutunu hedef instance'ta calistirir ve ciktisini basar.
function run_remote() {
  local -r description="$1"; local -r script_body="$2"

  local params
  params=$(python3 -c '
import json, sys
print(json.dumps({"commands": sys.stdin.read().split("\n")}))' <<< "$script_body")

  local command_id
  command_id=$(aws ${AWS_PROFILE_ARG} ${AWS_REGION_ARG} ssm send-command \
    --document-name "AWS-RunShellScript" \
    --targets "Key=$DEFAULT_TAG_KEY,Values=$TAG_VALUE" \
    --comment "$description" \
    --parameters "$params" \
    --query "Command.CommandId" --output text)
  if [ -z "$command_id" ]; then
    log_error "komut gonderilemedi"; return 1
  fi
  log_info "komut: $command_id ($description)"

  local status="Pending"
  local i
  for i in $(seq 1 60); do
    sleep 3
    status=$(aws ${AWS_PROFILE_ARG} ${AWS_REGION_ARG} ssm list-command-invocations \
      --command-id "$command_id" --details \
      --query "CommandInvocations[0].Status" --output text 2>/dev/null || echo "Pending")
    case "$status" in
      Success) break ;;
      Failed|Cancelled|TimedOut) break ;;
    esac
  done

  echo "----- sunucu ciktisi -----"
  aws ${AWS_PROFILE_ARG} ${AWS_REGION_ARG} ssm list-command-invocations \
    --command-id "$command_id" --details \
    --query "CommandInvocations[0].CommandPlugins[0].Output" --output text
  echo "--------------------------"

  if [ "$status" != "Success" ]; then
    log_error "uzak komut basarisiz: $status"; return 1
  fi
  log_info "tamam ($status)"
}

function main() {
  local command=""
  local prefix="$DEFAULT_PREFIX"
  local app_dir="$DEFAULT_APP_DIR"
  TAG_VALUE="$DEFAULT_TAG_VALUE"
  AWS_PROFILE_ARG=""
  AWS_REGION_ARG=""

  if [[ $# -gt 0 && "$1" != --* ]]; then
    command="$1"; shift
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prefix)     prefix="$2"; shift 2 ;;
      --app-dir)    app_dir="$2"; shift 2 ;;
      --tag-value)  TAG_VALUE="$2"; shift 2 ;;
      --profile)    AWS_PROFILE_ARG="--profile $2"; shift 2 ;;
      --region)     AWS_REGION_ARG="--region $2"; shift 2 ;;
      --help)       print_usage; exit 0 ;;
      *)            log_error "bilinmeyen secenek: $1"; print_usage; exit 1 ;;
    esac
  done

  assert_is_installed "aws"
  assert_is_installed "python3"

  case "$command" in
    keys)
      run_remote "secret anahtarlarini listele" \
"set -e
grep -vE '^[[:space:]]*#|^[[:space:]]*\$' $app_dir/docker-compose.env | cut -d= -f1 | sort"
      ;;
    seed-dry)
      run_remote "secret seed (kuru kosu)" \
"set -e
bash $app_dir/scripts/secrets-put.sh --prefix $prefix --env-file $app_dir/docker-compose.env"
      ;;
    seed)
      run_remote "secret seed (yaz)" \
"set -e
bash $app_dir/scripts/secrets-put.sh --prefix $prefix --env-file $app_dir/docker-compose.env --apply"
      ;;
    render)
      run_remote "docker-compose.env render" \
"set -e
bash $app_dir/scripts/secrets-render.sh --prefix $prefix --out $app_dir/docker-compose.env --manifest $app_dir/secrets.manifest"
      ;;
    diff)
      run_remote "dosya ve Parameter Store anahtarlarini karsilastir" \
"set -e
grep -vE '^[[:space:]]*#|^[[:space:]]*\$' $app_dir/docker-compose.env | cut -d= -f1 | sort > /tmp/.k_file
aws ssm get-parameters-by-path --path $prefix --recursive --query 'Parameters[].Name' --output text | tr '\t' '\n' | sed 's#.*/##' | sort > /tmp/.k_ssm
echo 'yalnizca DOSYADA:'; comm -23 /tmp/.k_file /tmp/.k_ssm | sed 's/^/  /'
echo 'yalnizca PARAMETER STORE da:'; comm -13 /tmp/.k_file /tmp/.k_ssm | sed 's/^/  /'
echo \"ortak: \$(comm -12 /tmp/.k_file /tmp/.k_ssm | wc -l | tr -d ' ')\"
rm -f /tmp/.k_file /tmp/.k_ssm"
      ;;
    *)
      log_error "komut gerekli: keys | seed-dry | seed | render | diff"
      print_usage; exit 1 ;;
  esac
}

main "$@"
