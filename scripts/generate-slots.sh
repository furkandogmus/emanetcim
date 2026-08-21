#!/bin/bash
# ============================================================
# BagajPark - Günlük slot üretimi
# ============================================================
# Aktif dükkanlar için ileri tarihli zaman slotlarını üretir.
#
# NEDEN VAR: Slot üretimi 2026-07-14'te durdu ve onu çalıştıran hiçbir zamanlanmış
# iş yoktu. Sonuç 37 gün boyunca fark edilmedi: her dükkanın ilan ettiği saatlik
# ürün seçilemez hâle geldi (slot seçici boş kaldı) ve per-slot kapasite kontrolü
# yerini kaba, dükkan geneli bir kontrole bıraktı. Slotlar 30 gün ileriye
# üretildiği için bu iş çalışmazsa kesinti sessizce tekrarlanır.
#
# SIR CRONTAB'A YAZILMAZ: CRON_SECRET çalışma anında .env'den okunur. Crontab
# dosyasına gömülen bir token, `crontab -l` çalıştıran herkese görünür olur.
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

readonly APP_DIR="/root/emanetci"
readonly ENV_FILE="$APP_DIR/.env"
readonly ENDPOINT="https://bagajpark.com/api/internal/generate-slots"

function log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

if [ ! -f "$ENV_FILE" ]; then
  log "HATA: $ENV_FILE bulunamadi"
  exit 1
fi

# Deger stdout'a hic basilmaz; yalnizca degiskene alinir.
CRON_SECRET=$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'[:space:]')
if [ -z "$CRON_SECRET" ]; then
  log "HATA: CRON_SECRET .env icinde tanimli degil veya bos"
  exit 1
fi

log "Slot uretimi tetikleniyor..."

# --fail KULLANILMIYOR: -sf, 404/401'de sessizce cikar ve hicbir sey loglamaz.
# Odeme mutabakat cron'u tam bu yuzden 2 ay boyunca 404 alip kimseye haber
# vermedi. Burada durum kodunu ve govdeyi acikca yaziyoruz.
HTTP_BODY=$(mktemp)
HTTP_CODE=$(curl -s -o "$HTTP_BODY" -w '%{http_code}' \
  --max-time 120 \
  -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  "$ENDPOINT" || echo "000")

BODY=$(head -c 400 "$HTTP_BODY")
rm -f "$HTTP_BODY"

if [ "$HTTP_CODE" = "200" ]; then
  log "BASARILI (HTTP $HTTP_CODE): $BODY"
  exit 0
fi

log "BASARISIZ (HTTP $HTTP_CODE): $BODY"
log "  401 -> CRON_SECRET uyusmuyor | 503 -> uygulamada CRON_SECRET tanimsiz"
log "  404 -> uc kaldirilmis (mutabakat cron'unda oldugu gibi) | 000 -> baglanti kurulamadi"
exit 1
