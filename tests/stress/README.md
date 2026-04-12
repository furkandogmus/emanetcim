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

```bash
# Sunucuda çalıştır (swap, kernel tuning, pg index)
scp tests/stress/server-prepare.sh root@178.104.144.3:/tmp/
ssh root@178.104.144.3 -p 12022 "bash /tmp/server-prepare.sh"
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
