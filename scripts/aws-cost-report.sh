#!/bin/bash
# Gunluk AWS maliyet raporu: dunku harcama, ay basindan beri toplam ve kalan
# free tier kredisi. Resend ile e-posta atar. Prod EC2'de cron'dan calisir.
#
# NEDEN (2026-09-23): hesap AWS'nin FREE planinda. 2026-09-23'te kalan kredi
# $122.12, eylul harcamasi gunde ~$2.4 -- bu hizla kredi Kasim ortasinda
# biter, plan bitis tarihi (2027-02-23) degil. Harcamayi kimse izlemiyordu.
#
# Yetki: EC2 rolu (statik anahtar yok) -- ce:GetCostAndUsage,
# freetier:GetAccountPlanState (infra/aws/stack/main.tf `app_cost_read`) ve
# alici adresi icin SSM okuma. Cost Explorer istek basina $0.01 ucretli;
# gunluk kosu 2 istek = ayda ~$0.60.

set -e

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_DIR="${SCRIPT_DIR}/logs"

readonly DEFAULT_ENV_FILE="/opt/emanetci/docker-compose.env"
readonly DEFAULT_TO_PARAM="/bagajpark/env/app/COST_REPORT_TO"
readonly DEFAULT_REGION="eu-central-1"
# Cost Explorer ve Free Tier API'leri yalnizca us-east-1'de.
readonly BILLING_REGION="us-east-1"
readonly RESEND_URL="https://api.resend.com/emails"
readonly DEFAULT_FROM="BagajPark <info@bagajpark.com>"

# Set in main once --log-file is known. Empty means terminal only.
LOG_FILE=""

function log {
  local readonly level="$1"
  local readonly message="$2"
  local readonly timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  local readonly line="${timestamp} [${level}] [$SCRIPT_NAME] ${message}"

  >&2 echo -e "$line"

  if [[ -n "$LOG_FILE" ]]; then
    echo -e "$line" >> "$LOG_FILE"
  fi
}

function log_info {
  local readonly message="$1"
  log "INFO" "$message"
}

function log_warn {
  local readonly message="$1"
  log "WARN" "$message"
}

function log_error {
  local readonly message="$1"
  log "ERROR" "$message"
}

function print_usage {
  echo
  echo "Usage: $SCRIPT_NAME [OPTIONS]"
  echo
  echo "Dunku AWS harcamasini, ay toplamini ve kalan free tier kredisini e-postayla gonderir."
  echo
  echo "Options:"
  echo
  echo -e "  --to\t\t\tAlici e-posta. Optional. Verilmezse SSM'den okunur (--to-param)."
  echo -e "  --to-param\t\tAliciyi tutan SSM parametresi. Default: $DEFAULT_TO_PARAM"
  echo -e "  --env-file\t\tRESEND_API_KEY / RESEND_FROM okunacak dosya. Default: $DEFAULT_ENV_FILE"
  echo -e "  --region\t\tSSM bolgesi. Default: $DEFAULT_REGION"
  echo -e "  --dry-run\t\tE-postayi gondermez, icerigi loglar."
  echo -e "  --log-file\t\tAppend all output to this file as well as the terminal."
  echo -e "  \t\t\tDefault: logs/<UTC timestamp>.log next to this script."
  echo -e "  --no-log-file\t\tTerminal only, write no log file."
  echo
  echo "Example:"
  echo
  echo "  $SCRIPT_NAME --dry-run --no-log-file"
  echo "  $SCRIPT_NAME --log-file /opt/emanetci/logs/aws-cost-report.log"
}

function assert_not_empty {
  local readonly arg_name="$1"
  local readonly arg_value="$2"

  if [[ -z "$arg_value" ]]; then
    log_error "The value for '$arg_name' cannot be empty"
    print_usage
    exit 1
  fi
}

function assert_is_installed {
  local readonly name="$1"

  if [[ ! $(command -v ${name}) ]]; then
    log_error "The binary '$name' is required by this script but is not installed or in the system's PATH."
    exit 1
  fi
}

# `date -d` GNU'ya ozgu; script yerelde (macOS) de denenebilsin diye python.
function utc_date {
  local readonly offset_days="$1"
  python3 -c "import datetime as d; print((d.datetime.now(d.timezone.utc).date() + d.timedelta(days=$offset_days)).isoformat())"
}

function month_start {
  python3 -c "import datetime as d; print(d.datetime.now(d.timezone.utc).date().replace(day=1).isoformat())"
}

# Kredi haric (brut) harcama. Kredi satirlari dahil edilirse tutar ~0 gorunur.
function gross_cost {
  local readonly start="$1"
  local readonly end="$2"
  local amount=""

  if [[ "$start" == "$end" ]]; then
    echo "0"
    return 0
  fi

  if ! amount=$(aws ce get-cost-and-usage \
    --region "$BILLING_REGION" \
    --time-period "Start=${start},End=${end}" \
    --granularity MONTHLY \
    --metrics UnblendedCost \
    --filter '{"Not":{"Dimensions":{"Key":"RECORD_TYPE","Values":["Credit"]}}}' \
    --query 'sum(ResultsByTime[].to_number(Total.UnblendedCost.Amount))' \
    --output text); then
    log_error "Cost Explorer okunamadi ($start..$end)"
    return 1
  fi
  echo "$amount"
}

function env_file_value {
  local readonly file="$1"
  local readonly key="$2"
  # `source` DEGIL: dosya sir tasiyor ve kabuk olarak calistirilmamali.
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'
}

function main {
  local to=""
  local to_param="$DEFAULT_TO_PARAM"
  local env_file="$DEFAULT_ENV_FILE"
  local region="$DEFAULT_REGION"
  local dry_run="false"
  local log_file_arg=""
  local no_log_file="false"

  while [[ $# > 0 ]]; do
    local key="$1"

    case "$key" in
      --to)
        to="$2"
        shift
        ;;
      --to-param)
        to_param="$2"
        shift
        ;;
      --env-file)
        env_file="$2"
        shift
        ;;
      --region)
        region="$2"
        shift
        ;;
      --dry-run)
        dry_run="true"
        ;;
      --log-file)
        log_file_arg="$2"
        shift
        ;;
      --no-log-file)
        no_log_file="true"
        ;;
      --help)
        print_usage
        exit
        ;;
      *)
        log_error "Unrecognized argument: $key"
        print_usage
        exit 1
        ;;
    esac

    shift
  done

  if [[ "$no_log_file" != "true" ]]; then
    local candidate=""
    if [[ -n "$log_file_arg" ]]; then
      candidate="$log_file_arg"
    else
      mkdir -p "$LOG_DIR"
      candidate="${LOG_DIR}/$(date -u +"%Y%m%dT%H%M%SZ").log"
    fi

    if ! touch "$candidate" 2>/dev/null; then
      log_error "cannot write to log file '$candidate'"
      exit 1
    fi

    LOG_FILE="$candidate"
    log_info "log file    : $LOG_FILE"
  fi

  assert_not_empty "--region" "$region"
  assert_is_installed "aws"
  assert_is_installed "python3"
  assert_is_installed "curl"

  if [[ -z "$to" ]]; then
    assert_not_empty "--to-param" "$to_param"
    if ! to=$(aws ssm get-parameter --region "$region" --name "$to_param" \
      --with-decryption --query Parameter.Value --output text); then
      log_error "alici okunamadi: SSM $to_param"
      exit 1
    fi
  fi
  assert_not_empty "--to" "$to"

  local api_key=""
  local from=""
  if [[ "$dry_run" != "true" ]]; then
    if [[ ! -r "$env_file" ]]; then
      log_error "env dosyasi okunamiyor: $env_file"
      exit 1
    fi
    api_key=$(env_file_value "$env_file" "RESEND_API_KEY")
    assert_not_empty "RESEND_API_KEY ($env_file)" "$api_key"
    from=$(env_file_value "$env_file" "RESEND_FROM")
  fi
  if [[ -z "$from" ]]; then
    from="$DEFAULT_FROM"
  fi

  local today=""
  local yesterday=""
  local first_of_month=""
  today=$(utc_date 0)
  yesterday=$(utc_date -1)
  first_of_month=$(month_start)

  local daily=""
  local month_to_date=""
  daily=$(gross_cost "$yesterday" "$today")
  month_to_date=$(gross_cost "$first_of_month" "$today")

  local plan=""
  if ! plan=$(aws freetier get-account-plan-state --region "$BILLING_REGION" \
    --query '[accountPlanType,accountPlanRemainingCredits.amount,accountPlanExpirationDate]' \
    --output text); then
    log_error "free tier plani okunamadi"
    exit 1
  fi

  log_info "dun ($yesterday): \$$daily | ay toplami: \$$month_to_date | plan: $plan"

  local payload=""
  payload=$(DAILY="$daily" MTD="$month_to_date" PLAN="$plan" TODAY="$today" \
    YESTERDAY="$yesterday" MONTH_START="$first_of_month" FROM="$from" TO="$to" \
    python3 - <<'PY'
import datetime as d, html, json, os

daily = float(os.environ["DAILY"] or 0)
mtd = float(os.environ["MTD"] or 0)
plan_type, remaining, expires = (os.environ["PLAN"].split("\t") + ["", "", ""])[:3]
remaining = float(remaining) if remaining not in ("", "None") else None
today = d.date.fromisoformat(os.environ["TODAY"])
days = max((today - d.date.fromisoformat(os.environ["MONTH_START"])).days, 1)
avg = mtd / days if mtd > 0 else daily

rows = [
    (f"Dun ({os.environ['YESTERDAY']})", f"${daily:,.2f}"),
    (f"Bu ay ({days} gun)", f"${mtd:,.2f}"),
    ("Gunluk ortalama", f"${avg:,.2f}"),
]
subject = f"BagajPark AWS: dun ${daily:,.2f}"
if remaining is not None:
    rows.append(("Kalan free tier kredisi", f"${remaining:,.2f}"))
    subject += f", kalan kredi ${remaining:,.2f}"
    if avg > 0:
        runway = int(remaining / avg)
        end = today + d.timedelta(days=runway)
        rows.append(("Bu hizla kredi biter", f"~{runway} gun ({end.isoformat()})"))
if expires:
    rows.append(("Plan bitis tarihi", expires[:10]))
rows.append(("Plan", plan_type or "?"))

cells = "".join(
    f"<tr><td style='padding:6px 16px 6px 0;color:#555'>{html.escape(k)}</td>"
    f"<td style='padding:6px 0;font-weight:bold'>{html.escape(v)}</td></tr>"
    for k, v in rows
)
body = (
    "<div style='font-family:sans-serif;font-size:14px'>"
    f"<table>{cells}</table>"
    "<p style='color:#888;font-size:12px'>Kaynak: Cost Explorer (kredi haric brut tutar) "
    "ve Free Tier API. Hesap 772853132412. scripts/aws-cost-report.sh</p></div>"
)
text = "\n".join(f"{k}: {v}" for k, v in rows)
print(json.dumps({"from": os.environ["FROM"], "to": [os.environ["TO"]],
                  "subject": subject, "html": body, "text": text}))
PY
  )

  if [[ "$dry_run" == "true" ]]; then
    log_info "dry-run, gonderilmedi. Icerik:"
    log_info "$(python3 -c 'import json,sys; p=json.load(sys.stdin); print(p["subject"]); print(p["text"])' <<< "$payload")"
    return 0
  fi

  local status=""
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
    -X POST "$RESEND_URL" \
    -H "Authorization: Bearer ${api_key}" \
    -H "Content-Type: application/json" \
    --data-binary "$payload")

  if [[ "$status" != "200" ]]; then
    log_error "Resend HTTP $status -- e-posta gonderilmedi"
    exit 1
  fi
  log_info "e-posta gonderildi"
}

main "$@"
