#!/usr/bin/env bash
# Production'da e-posta+şifre ile kullanıcı oluşturur ya da günceller.
# /api/admin/setup endpointini kullanır; ADMIN_SETUP_KEY gereklidir.
#
# Kullanım:
#   ./scripts/create-user.sh
#
# Ortam değişkenleri (isteğe bağlı override):
#   BASE_URL=https://uncloudy-sarahi-terminably.ngrok-free.dev
#   ADMIN_SETUP_KEY=<sunucudakiyle aynı değer>
#   USER_EMAIL=admin@emanetci.com
#   USER_PASSWORD=GucluSifre123!
#   USER_ROLE=ADMIN        # ADMIN | PARTNER | GUEST
#   USER_NAME="İsim Soyisim"

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
SETUP_KEY="${ADMIN_SETUP_KEY:-}"
EMAIL="${USER_EMAIL:-}"
PASSWORD="${USER_PASSWORD:-}"
ROLE="${USER_ROLE:-ADMIN}"
NAME="${USER_NAME:-}"

# ── Etkileşimli mod ────────────────────────────────────────────────────────
if [[ -z "$SETUP_KEY" ]]; then
  echo -n "ADMIN_SETUP_KEY (docker-compose.env): "; read -rs SETUP_KEY; echo
fi
if [[ -z "$EMAIL" ]]; then
  echo -n "E-posta          : "; read -r EMAIL
fi
if [[ -z "$PASSWORD" ]]; then
  echo -n "Şifre            : "; read -rs PASSWORD; echo
fi
if [[ -z "$NAME" ]]; then
  echo -n "İsim (boş=email) : "; read -r NAME
fi

ROLE_UPPER="${ROLE^^}"
echo ""
echo "Oluşturuluyor: $ROLE_UPPER <$EMAIL> → $BASE_URL/api/admin/setup"

BODY="{\"setupKey\":\"${SETUP_KEY}\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"role\":\"${ROLE_UPPER}\"${NAME:+,\"name\":\"${NAME}\"}}"

HTTP_STATUS=$(curl -s -o /tmp/setup-response.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/admin/setup" \
  -H "Content-Type: application/json" \
  -d "$BODY")

echo "HTTP $HTTP_STATUS"
cat /tmp/setup-response.json | python3 -m json.tool 2>/dev/null || cat /tmp/setup-response.json
echo ""

if [[ "$HTTP_STATUS" == "201" ]]; then
  echo "✓ Kullanıcı hazır. Giriş: $BASE_URL/login"
else
  echo "✗ Hata (HTTP $HTTP_STATUS). Yukarıdaki yanıtı inceleyin."
  exit 1
fi
