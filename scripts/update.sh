#!/bin/bash
# ============================================================
# BagajPark - Otomatik Güncelleme Scripti (GHCR Image tabanlı)
# ============================================================
# Bu script artık sadece docker-compose.yml ve config
# dosyalarını günceller; image build YAPMAZ.
# Image GitHub Actions tarafından GHCR'ye push edilir.
# ============================================================

set -e
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin

cd /root/emanetci

# 1. Uzak branch ile yerel arasındaki farkı kontrol et
git fetch origin develop
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/develop)

echo "[$(date)] --- Guncelleme Kontrolu ---"
echo "[$(date)] Yerel SHA: $LOCAL_SHA"
echo "[$(date)] Uzak  SHA: $REMOTE_SHA"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "[$(date)] Sistemsel bir degisiklik yok. Atlaniyor."
  exit 0
fi

echo "[$(date)] >>> Yeni commit bulundu! Uygulama guncelleniyor..."

# 2. Kodları çek (config dosyaları, nginx vb.)
git stash || true
git reset --hard origin/develop

# 3. Yeni image'ı GHCR'den çek
echo "[$(date)] GHCR'den yeni image cekiliyor..."
docker pull ghcr.io/furkandogmus/emanetcim:latest

# 4. Konteynerleri yeniden başlat (build YOK)
echo "[$(date)] Konteynerler yeniden baslatiliyor..."
docker compose up -d --no-build

# 5. Temizlik
echo "[$(date)] Kullanilmayan eski imajlar temizleniyor..."
docker image prune -f

echo "[$(date)] SUCCESS: BagajPark basariyla guncellendi: ($LOCAL_SHA -> $REMOTE_SHA)"
echo "--------------------------------------------------------"
