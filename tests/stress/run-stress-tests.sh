#!/usr/bin/env bash
# ============================================================
# BagajPark Stress Test Runner
# ============================================================
# Kullanım:
#   ./tests/stress/run-stress-tests.sh [senaryo] [base_url]
#
# Senaryolar: smoke | load | stress | spike | breakpoint
# ============================================================

set -euo pipefail

SCENARIO="${1:-smoke}"
BASE_URL="${2:-https://bagajpark.com}"
REPORT_DIR="tests/stress/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/${SCENARIO}_${TIMESTAMP}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          BagajPark Stress Test Runner                   ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║ Senaryo:   ${SCENARIO}"
echo "║ Hedef:     ${BASE_URL}"
echo "║ Rapor:     ${REPORT_FILE}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# k6 yüklü mü kontrol et
if ! command -v k6 &>/dev/null; then
  echo "❌ k6 bulunamadı. Yükleme:"
  echo "   macOS:  brew install k6"
  echo "   Linux:  sudo dnf install k6  (veya snap install k6)"
  echo "   Docker: docker run --rm -i grafana/k6 run -"
  exit 1
fi

mkdir -p "$REPORT_DIR"

# Senaryo bilgisi
declare -A VU_INFO
VU_INFO[smoke]="10 eş zamanlı kullanıcı — 2 dakika"
VU_INFO[load]="100 eş zamanlı kullanıcı — 7 dakika"
VU_INFO[stress]="1,000 eş zamanlı kullanıcı — 15 dakika"
VU_INFO[spike]="10,000 eş zamanlı kullanıcı — 5.5 dakika"
VU_INFO[breakpoint]="100,000 eş zamanlı kullanıcı — 20 dakika"

echo "📊 Senaryo: ${VU_INFO[$SCENARIO]:-bilinmiyor}"
echo "⏳ Test başlıyor..."
echo ""

# k6 çalıştır
k6 run \
  --env BASE_URL="$BASE_URL" \
  --env SCENARIO="$SCENARIO" \
  --out json="${REPORT_FILE}.json" \
  --summary-export="${REPORT_FILE}_summary.json" \
  tests/stress/k6-config.js \
  2>&1 | tee "${REPORT_FILE}.log"

echo ""
echo "✅ Test tamamlandı!"
echo "📁 Raporlar:"
echo "   Log:     ${REPORT_FILE}.log"
echo "   JSON:    ${REPORT_FILE}.json"
echo "   Özet:    ${REPORT_FILE}_summary.json"
echo ""
echo "HTML rapor için:"
echo "   k6 run ... --out web-dashboard"
