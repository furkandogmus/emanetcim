#!/bin/bash
# ============================================================
# Emanetçi - Otomatik Güncelleme Scripti
# ============================================================
# Kullanım: /root/emanetci/update.sh
# Cronjob : * * * * * /root/emanetci/update.sh >> /root/emanetci/update.log 2>&1
#
# Her saat başı GitHub develop branch'ini kontrol eder.
# Yeni commit varsa git pull + docker compose up --build çalıştırır.
# Değişiklik yoksa Docker'a dokunmaz.
# ============================================================

set -e
cd /root/emanetci

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git ls-remote origin refs/heads/develop | cut -f1)

echo "[$(date)] Local:  $LOCAL_SHA"
echo "[$(date)] Remote: $REMOTE_SHA"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "[$(date)] Degisiklik yok, atlaniyor."
  exit 0
fi

echo "[$(date)] Yeni commit bulundu! Guncelleniyor..."
git fetch origin develop
git reset --hard origin/develop

echo "[$(date)] Docker yeniden olusturuluyor..."
docker compose up -d --build

echo "[$(date)] Eski image temizleniyor..."
docker system prune -f

echo "[$(date)] Guncelleme tamamlandi. ($LOCAL_SHA -> $REMOTE_SHA)"
