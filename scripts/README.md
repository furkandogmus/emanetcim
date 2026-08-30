# Zamanlanmış işler — kurulum ve çalıştırma

## Son durum — 2026-08-30

> **Sekiz işin tamamı canlı sunucuda kurulu ve `enforced=true`.** 2026-08-29
> akşamı `crontab -l -u ec2-user` ile ölçüldü, eksik beş iş kuruldu ve kurulum
> sırasında çıkan üç gizli hata düzeltildi (`docs/DEFECT_BACKLOG.md` madde 9).
> Listenin repodaki kopyası: [`ops/crontab.prod`](../ops/crontab.prod) — sunucu
> giderse liste onunla gitmesin diye.

| İş | Cron | Sarmalayıcı | Metot | `enforced` |
|---|---|---|---|---|
| `generate-slots` | `17 4 * * *` | `generate-slots.sh` | POST | ✅ |
| `overdue-scan` | `47 4 * * *` | `overdue-scan.sh` | POST | ✅ |
| `booking-reminders` | `7 9 * * *` | — | GET | ✅ |
| `cleanup` | `23 3 * * *` | — | POST | ✅ |
| `seal-forecast` | `37 6 * * 1` | — | POST | ✅ |
| `classify-inbox` | `13 5 * * *` | — | POST | ✅ |
| `response-times` | `29 3 * * *` | — | POST | ✅ |
| `finance-export` | `53 2 * * *` | — | GET | ✅ |

> Bu tablonun kaynağı **`src/lib/jobs/registry.ts`**'tir. Elle güncellemeyin —
> `./scripts/emit-crontab.sh` çalıştırıp güncel hâli görün. Kayıt defterinin
> gerçekle ayrışmasını `src/__tests__/jobs-registry.test.ts` CI'da kırmızı yakar.
> **Metot sütunu da oradan gelir**: `booking-reminders` ve `finance-export`
> yalnızca `GET` export ediyor; sabit `POST` gönderilen bir crontab satırı ikisini
> de **405** ile sessizce düşürüyordu.

> **Açık kalan:** `booking-reminders` "bildirildi" işareti tutmuyor
> (`src/app/api/internal/booking-reminders/route.ts`), yani çıkış saati geçmiş açık
> bir rezervasyon varsa esnaf her koşuda aynı uyarıyı alır. Bugün tetikleyen kayıt
> yok (`CHECKED_IN` = 0), ama yenisi takılırsa geri gelir.

Hepsi `call-internal-job.sh` üzerinden çalışır; sarmalayıcısı olan işlerde iş adı
**sabitlenir** ki crontab'a elle yanlış ad yazılamasın.

**Sağlık kontrolü:** `GET /api/health/jobs` — sır gerektirmez, sağlıksızsa **503**
döner. Herhangi bir HTTP izleyici (UptimeRobot, Cloudflare health check, telefondan
`curl`) bunu izleyebilir. **Beş** sinyal ölçer:

| Kontrol | Neyi ölçer | `stale`/`broken` ne demek |
|---|---|---|
| `slotGeneration` | slot ufkunun tazeliği | üretim ~2 gündür çalışmamış |
| `overdueReconciliation` | en eski açık rezervasyonun yaşı | 72 saati aşmış açık rezervasyon var |
| `sealIntegrity` | mühür sahiplik değişmezi | sahipsiz `ASSIGNED` veya dükkanlı `STOCK` mühür var |
| `partnerReachability` | partnerin ulaşılabilir kanalı | ne e-postası ne telefonu olan partner var |
| `scheduledJobs` | işlerin son başarılı çalışması | `enforced` bir iş `maxStaleHours`'ı aşmış |

Biri bozuksa diğerleri **maskelemez** — toplam durum `DEGRADED` olur.

---

## Ön koşullar

- Sunucuda uygulama dizini: `/opt/emanetci` (farklıysa `--app-dir` ile verin).
- `CRON_SECRET` uygulamanın `.env` dosyasında tanımlı olmalı. Script değeri
  **çalışma anında** okur — crontab'a sır yazılmaz, çünkü `crontab -l` çalıştıran
  herkes görür.
- `curl` kurulu olmalı (script kontrol eder).

Sunucuya bağlandıktan sonra bir kez:

```bash
cd /opt/emanetci
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
47 4 * * * /opt/emanetci/scripts/overdue-scan.sh >> /var/log/bagajpark-overdue.log 2>&1
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
cd /opt/emanetci
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

---

## Slot saat dilimi onarımı — `repair-slot-timezone.sh`

**Neden gerekli (2026-08-24):** `generateSlotsForShop` duvar saatini
`new Date("2026-06-15T09:00:00")` ile ana çeviriyordu. Saat dilimi eki **olmayan**
bir ISO dizesi, çalışma ortamının **yerel** saatine göre ayrıştırılır; konteynerde
`TZ` ayarlı olmadığı için prod UTC. Sonuç: 09:00–20:00 açık bir İstanbul dükkanının
slotları `09:00Z–20:00Z` olarak üretiliyordu — misafirin takviminde **12:00–23:00**.

| Gerçek durum | Misafirin gördüğü | Sonuç |
|---|---|---|
| Dükkan açık, 09:00–12:00 | slot yok | arama dükkanı o pencerede eliyor |
| Dükkan kapalı, 20:00–23:00 | slot var | rezervasyon alınıyor; misafir geliyor; `isShopOpenAt` check-in'i **reddediyor** |

Geliştirici makinesi İstanbul saatinde olduğu için hata **yalnızca prod'da**
görünüyordu. Kod düzeltildi (`src/services/SlotService.ts`), ama üretim
`(shopId, startTime)` üzerinden `upsert` yapıyor: iş tekrar koştuğunda **doğru
slotlar eklenir, yanlış olanlar yerinde kalır**. Bu script yanlış olanları siler.

**Dokunulmayanlar:** rezervasyonu olan slotlar ve geçmiş slotlar — ikisi de
tarihsel kayıt. `open247` dükkanlar da kapsam dışı (her saat açıklar).

### 1. Kuru çalışma — hiçbir şey silmez

```bash
cd /opt/emanetci
./scripts/repair-slot-timezone.sh
```

Beklenen: önce dükkan başına gelecek slot tablosu (`ilk_slot_yerel` /
`son_slot_yerel` sütunları hatayı doğrudan gösterir — açılış 09:00 iken ilk slot
12:00 çıkıyorsa kayma budur), sonra:

```
[...] INFO  Toplam silinecek satir: <N>
[...] WARN  KURU CALISMA -- hicbir sey silinmedi.
```

Rezervasyonu **olan** ve kapalı saate düşen slot varsa ayrıca uyarır. Onlara
dokunulmaz: her biri için esnafla konuşulup misafire yeni saat önerilmelidir.

### 2. Yedek al — **silmeden önce zorunlu**

```bash
./scripts/backup.sh
```

### 3. Sil — **ilk değiştiren adım**

```bash
./scripts/repair-slot-timezone.sh --apply
```

### 4. Slotları yeniden üret — **zorunlu, atlanamaz**

```bash
./scripts/generate-slots.sh
```

3. adımdan sonra doğru saatlerdeki slotlar **henüz yoktur**; bu adım koşmadan
dükkanların saatlik ürünü seçilemez hâlde kalır.

### 5. Doğrula

```bash
./scripts/repair-slot-timezone.sh
```

Beklenen: `Toplam silinecek satir: 0` ve dükkan tablosunda `ilk_slot_yerel`
değerinin `acilis` ile, `son_slot_yerel` değerinin `kapanis`'tan bir slot öncesiyle
uyuşması.

### Geri alma

Silme satır satır geri alınamaz; geri dönüş yolu 2. adımdaki yedektir. Ancak
slotlar türetilmiş veridir: yedek olmadan da `generate-slots.sh` doğru slotları
yeniden üretir. Kaybolan tek şey silinen yanlış satırlardır ki amaç zaten odur.

---

## Crontab'ı kayıt defterinden üretme

İş tanımlarının tek kaynağı **`src/lib/jobs/registry.ts`**'tir. Crontab'ı elle
yazmak, kayıt defteriyle gerçeğin ayrılmasının ta kendisidir — slot üretiminin
37 gün, ödeme mutabakat cron'unun 2 ay fark edilmeden durması bu yüzdendi (P1-11).

### 1. Üretilecek satırları gör — hiçbir şey değiştirmez

```bash
cd /opt/emanetci
./scripts/emit-crontab.sh
```

Her iş için ne yaptığı, çalışmazsa ne olacağı ve cron satırı yazılır. `enforced`
olmayan işlerde ayrıca bir not düşülür.

### 2. Mevcut crontab'ı yedekle

```bash
crontab -l > /tmp/crontab.bak && wc -l /tmp/crontab.bak
```

### 3. Ekle — **ilk değiştiren adım**

`emit-crontab.sh | crontab -` **kullanmayın**: mevcut crontab'ı ezer. Ekleyin:

```bash
(crontab -l; ./scripts/emit-crontab.sh 2>/dev/null) | crontab -
```

Doğrulama:

```bash
crontab -l | grep -c bagajpark-
```

Beklenen: kurduğunuz iş sayısı kadar satır.

### 4. Bir iş gerçekten çalıştıktan sonra `enforced` yap

Yeni kurulan bir iş kayıt defterinde `enforced: false`'tur. Bu bilinçli: cron'u
kurulmamış bir iş **"bozuk" değil, "beklemede"dir** ve onu kırmızı saymak kalıcı
kırmızı bir sağlık kontrolü demektir — kalıcı kırmızı, kimsenin bakmadığı
kontroldür.

İş ilk kez başarıyla çalıştıktan sonra:

```bash
curl -s https://bagajpark.com/api/health/jobs | jq '.checks.scheduledJobs.jobs[] | {job, lastSuccessAt, status}'
```

`lastSuccessAt` dolu görünen işler için `src/lib/jobs/registry.ts` içinde
`enforced: true` yapın ve deploy edin. Artık o iş durursa sağlık kontrolü 503 döner.

### Geri alma

```bash
crontab /tmp/crontab.bak
```


---

## Gelen kutusunu sınıflandırma (tek seferlik + günlük)

`destek@bagajpark.com`'a gelen her e-posta `ContactMessage` olarak yazılıyor.
2026-08-22'de kutuda 67 mesaj vardı, **57'si okunmamış** ve ezici çoğunluğu soğuk
pazarlamaydı — gerçek bir misafir şikâyeti bunların arasında kaybolur.

Yeni mesajlar **giriş anında** sınıflandırılıyor. Geçmiş mesajlar için bu işi bir
kez çalıştırın:

```bash
cd /opt/emanetci
./scripts/call-internal-job.sh --job classify-inbox
```

Beklenen:

```
[...] INFO  BASARILI (HTTP 200): {"ok":true,"classified":67,"byCategory":{"BULK":54,"SUPPORT":11,"AUTOMATED":2},"remaining":0,"moreToDo":false}
```

`moreToDo: true` görürseniz kutu tek partiye sığmamış demektir (parti 500) —
`remaining` sıfırlanana kadar tekrar çalıştırın. İş **idempotenttir**: yalnızca
`UNCLASSIFIED` satırlara dokunur, ikinci çalıştırma `classified: 0` döner.

Sonra `/admin/messages` varsayılan olarak yalnızca **Destek** gösterir; seçicideki
sayaçlar diğer kategorilerde ne biriktiğini bakmadan söyler.

> Sınıflandırma migrasyonda SQL ile yapılmadı: kural `List-Unsubscribe` /
> `Auto-Submitted` gibi başlıklara bakıyor ve o başlıklar `raw` JSON'unun içinde.
> SQL'de yeniden yazmak, kuralın ikinci bir kopyası olurdu ve iki kopya ayrışırdı.

---

## nginx konfig doğrulaması — `verify-nginx-conf.sh`

`nginx/conf.d/*.conf` dosyalarını **gerçek** bir nginx binary'sine `nginx -t` ile
sınatır. Repoyu değiştirmez; dosyaları geçici bir dizine kopyalar ve yalnızca
yerelde çözülemeyen iki şeyi ikame eder: TLS sertifika yolları (sadece sunucuda
var) ve `upstream server web:3000` (sadece compose ağında çözülür). Geri kalan her
satır — `limit_req`, `location` önceliği, başlıklar — olduğu gibi sınanır.

```bash
bash scripts/verify-nginx-conf.sh                  # docker varsa onu kullanir
bash scripts/verify-nginx-conf.sh --engine docker  # kesin cevap; CI bunu koşar
```

Beklenen çıktı:

```
[...] INFO  Motor: docker, imaj nginx:1.27-alpine (uretimle AYNI surum)
nginx: configuration file .../nginx.conf test is successful
[...] INFO  Konfig gecerli.
```

Çıkış kodu 0 = geçerli, 1 = geçersiz.

**Hangi nginx sürümüyle doğruladığı önemli — bu ilk koşuşta ısırdı.** Sürüm
`docker-compose.yml`'deki `image: nginx:...` satırından okunur, elle yazılmaz.
İlk hâli CI'da `apt-get install nginx-core` diyordu; Ubuntu 24.04 bunun **1.24**'ünü
veriyor ve o sürüm `http2 on;` direktifini **tanımıyor** (ayrı direktif olarak
1.25.1'de geldi). Üretim `nginx:1.27-alpine` koşuyor ve direktif orada geçerli —
yani kapı **doğru bir konfigi reddetti**. Yanlış negatif üreten bir kapı hiç
olmayandan kötüdür: insanlara onu baypas etmeyi öğretir.

Docker yoksa script yerel `nginx` binary'sine düşer ama sürüm farklıysa **uyarır**;
o mod hızlı bir ön kontroldür, kesin cevap değildir.

**Neden zorunlu bir adım:** 2026-08-30'dan beri deploy `nginx/conf.d`'yi canlıya
gönderiyor (öncesinde göndermiyordu ve repodaki konfig ile sunucudaki ayrı
yaşıyordu). Yani bozuk bir konfig artık **siteyi kapatabilir**. İki kapı var:
CI'nın `verify` işi bu scripti koşar (bozuk konfig S3'e hiç ulaşmaz) ve sunucuda
`up -d`'den sonra `docker compose exec -T nginx nginx -t` koşar (geçmezse deploy
kırmızı düşer). Konfige dokunduysanız yerelde de koşturun.

---

## Talep testi noktaları — `prelaunch-points.ts`

Bir şehirde esnafla anlaşmadan **önce** orada müşteri olup olmadığını ölçer.
Nokta aramada ve haritada normal görünür; misafir rezervasyona kalkıştığı an
"burası yakında açılıyor, haber verelim" görür ve isterse e-posta bırakır.

```bash
npx tsx scripts/prelaunch-points.ts                      # KURU ÇALIŞMA (varsayılan)
npx tsx scripts/prelaunch-points.ts --list               # şehir listesi + sayılar
npx tsx scripts/prelaunch-points.ts --apply              # 482 nokta, 252 şehir
npx tsx scripts/prelaunch-points.ts --apply --city bodrum
npx tsx scripts/prelaunch-points.ts --verify             # koordinat denetimi (ağ ister)
npx tsx scripts/prelaunch-points.ts --apply --close istanbul-taksim
```

Beklenen kuru çalışma çıktısı: `482 nokta, 252 sehir  [KURU CALISMA -- hicbir sey
yazilmaz]` ve nokta başına bir `OLUSTUR`/`guncelle` satırı. **İdempotenttir** —
ikinci koşu kopya üretmez, `slug` üzerinden günceller (ölçüldü).

`--city` argümanı listedeki `key` alanıdır (`--list` ile görülür), slug öneki
değil: liste yüzlerce noktaya çıktığında önek eşleşmesi iki şehri sessizce
birbirine karıştırabilirdi.

### Rezervasyon ALMAZ — üç katman

1. **Arayüz**: `isPrelaunch` noktalarında rezervasyon düğmesinin yerini
   `PrelaunchNotifyButton` alır (`ShopDetailClient`, iki CTA da) ve **fiyat
   gösterilmez** — bu noktalarda `pricePerDay` şema varsayılanıdır (₺50), yani
   gerçek bir fiyat değil; yerine "Yakında" rozeti yazılır. Aynı kural üç
   yüzeyde birden geçerli ve ayrışmamalı: detay sayfası, arama sonucu kartı
   (`ShopListItem` — müsaitlik rozeti de çizilmez, CTA "Haber ver" olur) ve
   harita pin'i (`SearchMap`).

2. **Sunucu**: `createInitialBooking` → `BookingShopPrelaunchError`
   (`SHOP_PRELAUNCH`). Web `Errors.shopNotOpenYet`, mobil `409 shop_not_open_yet`.
   Arayüz tek başına yeterli değil: mobil uç, doğrudan API çağrısı ya da
   önbelleğe alınmış eski bir sayfa aynı yolu deneyebilir.
3. **Filtre**: `OPERATING_SHOP_FILTER` (`src/lib/public-shop-filter.ts`) bu
   noktaları slot üretiminden, `/api/health/jobs` slot beklentisinden ve
   `partnerReachability`den dışarıda tutar — yani talep testi, sağlık sinyalini
   kirletmez.

**Neden bu kadar katman:** bir rezervasyonun bedelini valiziyle boş adrese giden
misafir öder. Tek bir katmanın unutulması yeterlidir.

### Aramada GÖRÜNÜR — ve bu bir kez kırıldı

Talep testinin tamamı, misafirin noktayı aramada görüp tıklamasına bağlı. Ama bu
noktalar tanım gereği **slot üretmiyor** ve `findShopsForSearch` slot dalında
`slots.length === 0` gördüğü her dükkanı eliyordu; eski kapasite dalında da
varsayılan 09:00–20:00 saatleri `isShopOpenForStay`e takılıyordu.

2026-08-31'de üretimde ölçüldü: 482 nokta yazılıyken, İstanbul'da 10 nokta
varken arama **"TÜM NOKTALAR (3)"** diyordu — talep testinin tamamı görünmezdi.

Düzeltme, prelaunch noktalarını `findShopsForSearch` içinde ayrı bir listede
toplayıp müsaitlik ve çalışma saati süzgeçlerinin dışında tutuyor. İki ayrıntı
kasıtlı:

- **Eski kapasite dalına düşme kararı yalnızca işletilen dükkanlara bakar.**
  Prelaunch noktaları `hits`i doldursaydı, slot tablosu boşken gerçek dükkanlar
  kapasite yedeğine hiç düşemez ve aramadan kaybolurdu.
- **Rezervasyon alabilen dükkan her zaman önce sıralanır**, prelaunch daha yakın
  olsa bile: misafire önce gerçekten valizini bırakabileceği yer gösterilir.

Kural `src/__tests__/search-prelaunch-visibility.test.ts` ile ölçülüyor —
düzeltme geri alındığında 5 testin 3'ü kırılıyor (doğrulandı). Aramaya yeni bir
süzgeç eklerken bu dosyaya bakın: prelaunch'u eleyen bir süzgeç hiçbir hata
mesajı üretmez, nokta sessizce yok olur.


### Kamuya açık sayılar prelaunch'u SAYMAZ

`activeLocations` (ana sayfa güven bandı) ve `activePartnerCount`
(`/become-partner` sosyal kanıtı) `OPERATING_SHOP_FILTER` kullanır. Sorulan soru
"gösterilsin mi" değil "burada iş yapılıyor mu": talep testi noktalarını saymak,
misafire valizini bırakamayacağı yerleri kapasite, esnafa da olmayan ortakları
sosyal kanıt diye ilan etmek olurdu. Liste büyüdükçe bu fark büyüyor.

### Sonuçlar nerede okunur

`/admin/prelaunch` — şehir ve nokta bazında "açılınca haber ver" sayısı. Aynı
kişi iki kez sayılmaz (`@@unique([shopId, email])`), çünkü karar bu sayıya
bakılarak veriliyor. **Sinyal almamış noktalar tabloda listelenmez**, sayıları
üstteki satırda durur — birkaç yüz satırlık "0" listesi asıl sinyali görünmez
kılardı, ama sıfırları büsbütün susturmak da "3 kayıt" rakamını paydasız
bırakırdı.

Yanında analitik: `shop_view` (sunucu, koşulsuz), `prelaunch_booking_attempt`
(istemci, çerez onayına bağlı), `prelaunch_interest` (sunucu).

### Koordinatlar nereden geldi

Elle yazılmadılar: 2026-08-30'da her nokta için bir yer adı sorgusu (ör.
"Sultanahmet Meydanı, Fatih, İstanbul") Nominatim'e ileri geocode ettirildi,
dönen değer listeye yazıldı, ülke kodu tutmayanlar elendi. Yine de bunlar ilgili
semtin merkezine yakın değerlerdir, gerçek bir dükkan adresi **değildir** —
ölçülen soru "bu semtte talep var mı".

`--verify` bu iddiayı denetlenebilir tutar: her koordinatı **ters** geocode edip
dönen ülke kodunu listedeki `country` ile karşılaştırır (ileri yön aynı sorguyu
tekrarlamak, yani kendi kendini onaylamak olurdu). Elle düzeltilen bir noktada en
sık yapılan hata — enlem/boylamı ters yazmak, işaret düşürmek — tam buradan
yakalanır. Nominatim politikası gereği saniyede bir istek; tüm liste birkaç
dakika sürer, `--city` ile daraltılabilir.

Taşımak/eklemek için scriptteki `CITIES` listesini düzenleyip `--apply` ile
yeniden koşun.

**Koşuldu (2026-08-30):** `--verify` 482 noktanın hepsinde `hepsi dogru ulkede`
döndü (önce 456'lık liste toptan, sonra elle koordinat eklenen 10 şehir tek tek).

### Üretime uygulandı — 2026-08-31

482 noktanın tamamı üretim veritabanına yazıldı (`Olusturulacak: 482,
Guncellenecek: 0` — prod'da daha önce hiç talep testi noktası yoktu). Hemen
ardından koşulan ikinci kuru çalışma `Olusturulacak: 0, Guncellenecek: 482`
verdi, yani idempotentlik üretimde de ölçüldü: kopya üretilmedi.

**Sıra önemliydi ve öyle uygulandı:** önce `OPERATING_SHOP_FILTER` düzeltmesinin
deploy'u tamamlandı, sonra noktalar yazıldı. Ters sırada ana sayfa ve
`/become-partner` kısa süreliğine 485 lokasyon/ortak iddia ederdi.

Uygulama sonrası üretimde ölçülenler:

| Ölçüm | Değer |
|---|---|
| `isPrelaunch` nokta / şehir | 482 / 252 |
| İşletilen dükkan (`OPERATING_SHOP_FILTER`) | 3 |
| Kamuya görünür (`PUBLIC_SHOP_FILTER`) | 485 |
| `/become-partner` sosyal kanıtı | `socialProofEarly` ("İlk esnaf ortaklarımızdan biri olun") — eski filtreyle "485 aktif esnaf ortağı" yazacaktı |
| Bir nokta sayfası (Paris/Eyfel) | fiyat yerine "Yakında"; `Valiz Fiyatları` bölümü ve `₺` yok |

Erişim yolu: üretim Postgres dışarı açık değil (`127.0.0.1:5433`), script yerelden
SSH tüneliyle koşuldu — sunucudaki imajda `scripts/` ve `src/` yok
(bkz. `Dockerfile`), o yüzden konteyner içinde koşturulamıyor.
