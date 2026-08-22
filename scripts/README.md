# Zamanlanmış işler — kurulum ve çalıştırma

## Son durum — 2026-08-22

| İş | Script | Önerilen sıklık | Uç | Durum |
|---|---|---|---|---|
| Slot üretimi | `generate-slots.sh` | günlük | `POST /api/internal/generate-slots` | ✅ prod'da kurulu (`17 4 * * *`) |
| Süre aşımı mutabakatı | `overdue-scan.sh` | günlük | `POST /api/internal/overdue-scan` | ⚠️ **kurulmadı** — aşağıdaki 3. adım |
| DB temizliği | — | günlük | `POST /api/internal/cleanup` | ⚠️ sarmalayıcı yok, cron yok |

Üçü de `call-internal-job.sh` üzerinden çalışır; iş adı ince sarmalayıcıda
**sabitlenir** ki crontab'a elle yanlış ad yazılamasın.

**Sağlık kontrolü:** `GET /api/health/jobs` — sır gerektirmez, sağlıksızsa **503**
döner. Herhangi bir HTTP izleyici (UptimeRobot, Cloudflare health check, telefondan
`curl`) bunu izleyebilir. İki sinyal ölçer: slot üretimi tazeliği ve en eski açık
rezervasyonun yaşı.

---

## Ön koşullar

- Sunucuda uygulama dizini: `/root/emanetci` (farklıysa `--app-dir` ile verin).
- `CRON_SECRET` uygulamanın `.env` dosyasında tanımlı olmalı. Script değeri
  **çalışma anında** okur — crontab'a sır yazılmaz, çünkü `crontab -l` çalıştıran
  herkes görür.
- `curl` kurulu olmalı (script kontrol eder).

Sunucuya bağlandıktan sonra bir kez:

```bash
cd /root/emanetci
```

---

## Adımlar

### 1. Salt okunur doğrulama — hiçbir şey değiştirmez

```bash
curl -s https://bagajpark.com/api/health/jobs | jq
```

Beklenen: `"status": "UP"` ve HTTP 200. `"DEGRADED"` + 503 görürsen `checks`
altındaki hangi kontrolün `stale` olduğuna bak:

- `slotGeneration.status = "stale"` → slot üretimi ~2 gündür çalışmamış.
- `overdueReconciliation.status = "stale"` → çıkış saatini 72 saatten fazla aşmış
  ve hâlâ açık en az bir rezervasyon var.

> **2026-08-22 itibarıyla bu uç 503 dönüyor** ve bu doğrudur: prod'da 18 açık
> gecikmiş rezervasyon var, en eskisi Haziran'dan beri. Kontrol çalışıyor demektir,
> bozuk demek değil. Rakam düzelince yeşile döner.

### 2. Süre aşımı taramasını elle bir kez çalıştır

İlk çalıştırma **olay yazar** (`BookingEvent` → `OVERDUE`), ama **hiçbir
rezervasyonun durumunu değiştirmez** — gerekçe `src/services/OverdueBookingService.ts`
başında.

```bash
./scripts/overdue-scan.sh
```

Beklenen çıktı (stderr'e, zaman damgalı):

```
[...] [call-internal-job.sh] INFO  overdue-scan tetikleniyor -> https://bagajpark.com/api/internal/overdue-scan
[...] [call-internal-job.sh] INFO  BASARILI (HTTP 200): {"ok":true,"scannedAt":"...","overdueCount":18,...}
```

Başarısızlıkta çıkış kodu 1 ve sebep açıkça yazılır:

| HTTP | Anlamı |
|---|---|
| 401 | `CRON_SECRET` uyuşmuyor |
| 503 | Uygulamada `CRON_SECRET` tanımsız |
| 404 | Uç kaldırılmış (ödeme mutabakat cron'unda böyle oldu, 2 ay fark edilmedi) |
| 000 | Bağlantı kurulamadı |

### 3. Günlük cron'a ekle — **ilk değiştiren adım**

```bash
crontab -e
```

Şu satırı ekleyin (slot üretiminden sonra çalışsın diye 4:47):

```
47 4 * * * /root/emanetci/scripts/overdue-scan.sh >> /var/log/bagajpark-overdue.log 2>&1
```

Doğrulama:

```bash
crontab -l | grep -c overdue-scan
```

Beklenen: `1`.

### 4. Ertesi gün doğrula

```bash
tail -20 /var/log/bagajpark-overdue.log
```

Beklenen: bir `BASARILI (HTTP 200)` satırı. İkinci çalıştırmada
`"eventsRecorded"` genelde **0** olur — tarama idempotenttir, aynı rezervasyon için
aynı eşiği iki kez yazmaz. Bu bir hata değil, doğru davranıştır.

---

## Geri alma

Cron'u kaldırmak:

```bash
crontab -l | grep -v overdue-scan | crontab -
```

Yazılan olayları geri almak gerekmez: `OVERDUE` olayları salt kayıttır, hiçbir
durumu veya parayı etkilemez. İstenirse temizlenebilir:

```sql
DELETE FROM "BookingEvent" WHERE event = 'OVERDUE';
```

---

## Farklı ortama çalıştırma

```bash
./scripts/overdue-scan.sh \
  --base-url https://staging.bagajpark.com \
  --app-dir /srv/bagajpark
```

`--help` her sarmalayıcıda çalışır.
