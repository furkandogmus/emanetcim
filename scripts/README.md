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
`curl`) bunu izleyebilir. **Üç** sinyal ölçer:

| Kontrol | Neyi ölçer | `stale`/`broken` ne demek |
|---|---|---|
| `slotGeneration` | slot ufkunun tazeliği | üretim ~2 gündür çalışmamış |
| `overdueReconciliation` | en eski açık rezervasyonun yaşı | 72 saati aşmış açık rezervasyon var |
| `sealIntegrity` | mühür sahiplik değişmezi | sahipsiz `ASSIGNED` veya dükkanlı `STOCK` mühür var |

Biri bozuksa diğerleri **maskelemez** — toplam durum `DEGRADED` olur.

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


---

## Mühür sahiplik onarımı (tek seferlik)

`STOCK` dışında olup hiçbir dükkana ait olmayan mühürleri `STOCK`'a geri alır.

**Neden gerekli:** 2026-08-22 denetiminde 1.277 mührün **1.247'si** `ASSIGNED` ama
`shopId` NULL'du. `ASSIGNED` + sahipsiz bir mühür **anlamsız** bir durumdur: hiçbir
dükkana atanmamış bir mühür "atanmış" olamaz. `STOCK`'a dönmesi bilgi kaybı değil,
bilginin düzeltilmesidir. Mühür anlaşmazlıkta fiziksel zilyetliğin kanıtı olduğu
için envanterin %96'sının eşleştirilememesi ciddi bir açıktı.

**Yeni bozuk satır artık oluşamaz:** `Seal_ownership_matches_status` DB kısıtı
`NOT VALID` olarak eklendi — mevcut satırlar tolere ediliyor, her yeni
INSERT/UPDATE kontrol ediliyor. Bu adım eskileri temizler ve kısıtı tamamlar.

### 1. Kuru çalışma — hiçbir şey değiştirmez

```bash
cd /root/emanetci
./scripts/repair-seal-ownership.sh
```

Beklenen: mevcut durum tablosu, ardından

```
[...] INFO  Onarilacak satir sayisi: 1249
[...] WARN  KURU CALISMA -- hicbir sey degistirilmedi.
[...] WARN  Gercekten onarmak icin: repair-seal-ownership.sh --apply
```

> 1249 = 1.247 sahipsiz `ASSIGNED` + 2 sahipsiz `FAULTY` (151 ve 152 — P0-6
> soruşturmasında test amaçlı işaretlendikleri doğrulanmıştı).

### 2. Yedek al — **onarımdan önce zorunlu**

```bash
./scripts/backup.sh
```

### 3. Onar ve kısıtı doğrula — **ilk değiştiren adım**

```bash
./scripts/repair-seal-ownership.sh --apply --validate
```

Beklenen:

```
[...] INFO  Onariliyor (1249 satir -> STOCK)...
[...] INFO  Onarim tamamlandi.
[...] INFO  DB kisiti dogrulaniyor...
[...] INFO  Kisit dogrulandi -- bundan sonra gecersiz satir DB seviyesinde imkansiz.
```

`VALIDATE CONSTRAINT` hata verirse onarım eksik kalmıştır: 1. adımı tekrar
çalıştırıp kalan satırları görün. Kısıt `NOT VALID` hâlinde kalır, yani yeni
yazımlar yine korunur — acil bir durum değildir.

### 4. Doğrula

```bash
curl -s https://bagajpark.com/api/health/jobs | jq '.checks.sealIntegrity'
```

Beklenen: `"status": "ok"`, `"orphanedNonStock": 0`, `"stockWithShop": 0`.

`checkedInWithoutSeals` alanı ayrı bir sorundur ve bu onarımla **düzelmez**:
bavula hiç mühür kaydedilmemiş `CHECKED_IN` rezervasyon sayısını verir
(2026-08-22'de 3). Bkz. `docs/DEFECT_BACKLOG.md` → P1-23.

### Geri alma

Onarım `assignedAt` alanını da `NULL` yapar, yani satır satır geri alınamaz.
Geri dönüş yolu 2. adımdaki yedektir — bu yüzden zorunlu.

Kısıt doğrulamasını geri almak (kısıtı `NOT VALID` hâline döndürmek) mümkün
değildir; kısıtın tamamen kaldırılması gerekir:

```sql
ALTER TABLE "Seal" DROP CONSTRAINT "Seal_ownership_matches_status";
```
