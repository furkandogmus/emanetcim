#!/usr/bin/env bash
# ============================================================
# Sunucu Stress Test Hazırlık Scripti
# ============================================================
# Stress test öncesi sunucu optimizasyonları.
# Sunucuda çalıştırılmalı:
#   bash tests/stress/server-prepare.sh
# ============================================================

set -euo pipefail

# Canli sunucu 2026-08-23 kesimiyle AWS EC2'ye tasindi; uygulama dizini
# /opt/emanetci. Eski Hetzner yolu (/root/emanetci) burada sabitlenmisti ve
# script son adimda `cd` hatasiyla duserdi.
APP_DIR="${APP_DIR:-/opt/emanetci}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     BagajPark — Sunucu Stress Test Hazırlık            ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ── 1. Swap Oluştur (yoksa) ─────────────────────────────────
if [ "$(swapon -s | wc -l)" -le 1 ]; then
  echo "💾 2GB Swap oluşturuluyor..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile swap swap defaults 0 0" >> /etc/fstab
  echo "   ✅ Swap aktif"
else
  echo "   ℹ️  Swap zaten mevcut"
fi

# ── 2. Kernel Tuning ────────────────────────────────────────
echo "🔧 Kernel parametreleri ayarlanıyor..."
cat > /etc/sysctl.d/99-stress-test.conf << 'SYSCTL'
# Ağ performansı
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_keepalive_probes = 5

# Dosya limitleri
fs.file-max = 2097152
fs.nr_open = 2097152

# Bellek
vm.swappiness = 10
vm.overcommit_memory = 1
SYSCTL
sysctl -p /etc/sysctl.d/99-stress-test.conf 2>/dev/null
echo "   ✅ Kernel parametreleri güncellendi"

# ── 3. Dosya Limitleri ──────────────────────────────────────
echo "📂 Dosya limitleri artırılıyor..."
cat > /etc/security/limits.d/99-stress.conf << 'LIMITS'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
LIMITS
ulimit -n 1048576 2>/dev/null || true
echo "   ✅ Dosya limitleri güncellendi"

# ── 4. PostgreSQL Tuning ─────────────────────────────────────
echo "🐘 PostgreSQL optimize ediliyor..."
docker exec emanetci-postgres-1 psql -U bagajpark -d bagajpark -c "
  -- pg_stat_statements eklentisi
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
" 2>/dev/null || true

# PG ayarlarını güncelle (container restart gerektirir)
docker exec emanetci-postgres-1 sh -c "cat >> /var/lib/postgresql/data/postgresql.conf << 'PG'

# === Stress Test Optimizasyonları ===
shared_buffers = 256MB
work_mem = 8MB
maintenance_work_mem = 128MB
effective_cache_size = 1GB
max_connections = 200
wal_buffers = 16MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1
effective_io_concurrency = 200
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
shared_preload_libraries = 'pg_stat_statements'
PG
"
echo "   ✅ PostgreSQL config güncellendi"

# ── 5. Nginx Tuning ─────────────────────────────────────────
echo "🌐 Nginx optimize ediliyor..."
docker exec emanetci-nginx-1 sh -c "sed -i 's/worker_connections  1024;/worker_connections  4096;/' /etc/nginx/nginx.conf"
echo "   ✅ Nginx worker_connections → 4096"

# ── 6. Eksik İndeksler ──────────────────────────────────────
echo "📊 Veritabanı indeksleri kontrol ediliyor..."
docker exec emanetci-postgres-1 psql -U bagajpark -d bagajpark -c "
  -- Shop tablosu seq_scan çok yüksek → index ekle
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_is_active ON \"Shop\" (\"isActive\") WHERE \"isActive\" = true;
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shop_location ON \"Shop\" USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  ) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

  -- Booking performansı
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_status ON \"Booking\" (status);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_guest_status ON \"Booking\" (\"guestId\", status);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_shop_status ON \"Booking\" (\"shopId\", status);
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_checkin ON \"Booking\" (\"checkInTime\");

  -- AuditLog
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditlog_created ON \"AuditLog\" (\"createdAt\" DESC);

  -- FeatureFlag
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_featureflag_key ON \"FeatureFlag\" (key);
" 2>/dev/null || true
echo "   ✅ İndeksler oluşturuldu"

# ── 7. Servisleri Yeniden Başlat ─────────────────────────────
echo "🔄 Servisleri yeniden başlatılıyor..."
cd "$APP_DIR"
docker compose restart postgres
sleep 5
docker compose restart nginx
docker compose restart web
echo "   ✅ Servisler yeniden başlatıldı"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Sunucu stress test için hazır!                      ║"
echo "║                                                         ║"
echo "║  Kontrol:                                               ║"
echo "║    docker stats --no-stream                             ║"
echo "║    curl -sk https://localhost/api/health                ║"
echo "╚══════════════════════════════════════════════════════════╝"
