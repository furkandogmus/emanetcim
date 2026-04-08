# ============================================================
# BagajPark - Otomatik Güncelleme ve Deployment Scripti
# ============================================================
# Kullanım: /root/emanetci/update.sh
# Cronjob : * * * * * /root/emanetci/update.sh >> /root/emanetci/update.log 2>&1
#
# Bu script GitHub develop branch'ini kontrol eder, değişiklik varsa
# sistemi durdurmadan yeni image'ları build eder ve Prisma 
# senkronizasyonunu (db push) otomatik olarak tetikler.
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

# 2. Kodları çek (Yerel değişiklikleri ezmemek için stash/reset)
git stash || true
git reset --hard origin/develop

# 3. Docker build ve restart
# --build flag'i Dockerfile içindeki 'prisma generate' adımını tetikler
# docker-entrypoint.sh ise 'prisma db push' adımını konteyner başladığında yapar.
echo "[$(date)] Docker konteynerlari yeniden insa ediliyor..."
docker compose up -d --build

# 4. Temizlik
echo "[$(date)] Kullanilmayan eski imajlar temizleniyor..."
docker image prune -f

echo "[$(date)] SUCCESS: BagajPark basariyla guncellendi: ($LOCAL_SHA -> $REMOTE_SHA)"
echo "--------------------------------------------------------"
