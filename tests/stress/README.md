# BagajPark Stress Test Altyapısı

## Hızlı Başlangıç

### 1. Gereksinimler

```bash
# k6 (ana araç)
brew install k6              # macOS
sudo dnf install k6          # Rocky/RHEL

# Artillery (alternatif — Node.js tabanlı)
npm install -g artillery

# Seed script için
npm install                  # proje bağımlılıkları
```

### 2. Test Verisi Oluştur (opsiyonel)

```bash
# 10 kullanıcı (smoke)
npx tsx tests/stress/seed-test-data.ts --level smoke

# 1000 kullanıcı (stress)
npx tsx tests/stress/seed-test-data.ts --level stress

# 100000 kullanıcı (breakpoint)
npx tsx tests/stress/seed-test-data.ts --level breakpoint

# Temizlik
npx tsx tests/stress/seed-test-data.ts --cleanup
```

### 3. Sunucu Hazırlığı

> **Bu script CANLI sunucuyu değiştirir** (swap açar, kernel parametrelerini yazar,
> Postgres/nginx yapılandırmasını düzenler, servisleri yeniden başlatır). Yük testi
> için hazırlanmış ayrı bir kutuda çalıştırın; canlıda çalıştırmak kesinti demektir.
>
> Adres bilgisi burada sabit tutulmuyor — `ops/server.env` içinden okunuyor. Önceki
> sürümde sabit bir IP ve port yazılıydı; ikisi de 2026-08-23 öncesi Hetzner kutusuna
> aitti ve artık geçerli değil.

```bash
source ops/server.env   # SSH_HOST / SSH_PORT / SSH_USER / SSH_KEY_PATH / APP_DIR

scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" \
  tests/stress/server-prepare.sh "$SSH_USER@$SSH_HOST:/tmp/"
ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" \
  "APP_DIR=$APP_DIR sudo -E bash /tmp/server-prepare.sh"
```

### 4. Test Çalıştır

```bash
# k6 ile
./tests/stress/run-stress-tests.sh smoke https://bagajpark.com
./tests/stress/run-stress-tests.sh load https://bagajpark.com
./tests/stress/run-stress-tests.sh stress https://bagajpark.com
./tests/stress/run-stress-tests.sh spike https://bagajpark.com
./tests/stress/run-stress-tests.sh breakpoint https://bagajpark.com

# Artillery ile
npx artillery run tests/stress/artillery-config.yml
npx artillery run tests/stress/artillery-config.yml -e stress
npx artillery run tests/stress/artillery-config.yml -e spike
```

### 5. Monitoring (opsiyonel)

```bash
# Grafana + Prometheus + cAdvisor
docker compose -f tests/stress/docker-compose.stress.yml up -d

# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

## Senaryo Detayları

| Senaryo     | VU      | Süre   | Amaç                              |
|-------------|---------|--------|-------------------------------------|
| smoke       | 10      | 2 dk   | Temel sağlamlık kontrolü           |
| load        | 100     | 7 dk   | Normal trafik simülasyonu          |
| stress      | 1,000   | 15 dk  | Yoğun dönem simülasyonu            |
| spike       | 10,000  | 5.5 dk | Ani trafik patlaması               |
| breakpoint  | 100,000 | 20 dk  | Kırılma noktası tespiti            |

## Başarı Kriterleri

| Metrik              | Kabul Edilebilir |
|---------------------|-------------------|
| p95 response time   | < 3 saniye       |
| p99 response time   | < 5 saniye       |
| Error rate          | < %10            |
| Health check        | Her zaman 200    |

## Raporlar

Test sonuçları `tests/stress/reports/` dizinine kaydedilir:
- `{senaryo}_{timestamp}.log` — konsol çıktısı
- `{senaryo}_{timestamp}.json` — detaylı metrikler
- `{senaryo}_{timestamp}_summary.json` — özet
