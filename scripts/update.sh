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

# 1. Uzak branch ile yerel arasındaki farkı kontrol et (config/nginx dosyaları için)
git fetch origin develop
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/develop)

echo "[$(date)] --- Guncelleme Kontrolu ---"
echo "[$(date)] Yerel SHA: $LOCAL_SHA"
echo "[$(date)] Uzak  SHA: $REMOTE_SHA"

GIT_CHANGED=false
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  GIT_CHANGED=true
  echo "[$(date)] >>> Yeni commit bulundu, kodlar cekiliyor (config/nginx)..."
  git stash || true
  git reset --hard origin/develop
fi

# 2. Image'in de degisip degismedigini AYRI kontrol et — git SHA ile image
# tag'i bagimsizdir: GHCR image'i sadece main'e push'ta build edilir, ve bu
# script her 5 dakikada calisir. Eger git SHA bu sirada zaten esitse ama CI
# build'i hala surerse (build ~5dk surebiliyor), yalnizca git SHA'ya bakan bir
# kontrol image'i HICBIR ZAMAN cekmez ve fix asla canliya cikmaz. Bu yuzden
# digest'i mutlaka ayrica karsilastiriyoruz. (2026-08-21: search sonuclarinin
# 0 gelmesine sebep olan bir fix, tam da bu yarisi yuzunden canliya cikmamisti.)
echo "[$(date)] GHCR'den image kontrol ediliyor..."
RUNNING_IMAGE_ID=$(docker inspect --format '{{.Image}}' emanetci-web-1 2>/dev/null || echo "none")
docker pull ghcr.io/furkandogmus/emanetcim:latest
NEW_IMAGE_ID=$(docker image inspect ghcr.io/furkandogmus/emanetcim:latest --format '{{.Id}}')

if [ "$GIT_CHANGED" = "false" ] && [ "$RUNNING_IMAGE_ID" = "$NEW_IMAGE_ID" ]; then
  echo "[$(date)] Sistemsel bir degisiklik yok (git ve image ayni). Atlaniyor."
  exit 0
fi

if [ "$RUNNING_IMAGE_ID" != "$NEW_IMAGE_ID" ]; then
  echo "[$(date)] >>> Yeni image tespit edildi ($RUNNING_IMAGE_ID -> $NEW_IMAGE_ID)."
fi

# 3. Konteynerleri yeniden başlat (build YOK)
echo "[$(date)] Konteynerler yeniden baslatiliyor..."
docker compose up -d --no-build

# 4. nginx'i yeniden baslat — web container yeniden olusturuldugunda (yeni image =
# yeni docker network IP) nginx eski IP'yi cache'leyip 502 verebilir (AWS test
# ortaminda 2026-08-21'de canlida yakalandi). Guvenlik agi olarak her deploy'da restart.
echo "[$(date)] nginx yeniden baslatiliyor (stale upstream IP onlemi)..."
docker compose restart nginx

# 5. Temizlik
echo "[$(date)] Kullanilmayan eski imajlar temizleniyor..."
docker image prune -f

echo "[$(date)] SUCCESS: BagajPark basariyla guncellendi: (git $LOCAL_SHA -> $REMOTE_SHA, image -> $NEW_IMAGE_ID)"
echo "--------------------------------------------------------"
