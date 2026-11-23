# scripts/ — zamanlanmış işler ve operasyon betikleri

## Son durum — 2026-11-23

> **On iş, hepsi `enforced=true`.** Kaynak `src/lib/jobs/registry.ts`; crontab satırlarını
> `scripts/emit-crontab.sh` üretir, sunucudaki listenin repodaki kopyası
> [`ops/crontab.prod`](../ops/crontab.prod). `src/__tests__/jobs-registry.test.ts`
> kayıt defteri ile `/api/internal/*` uçlarının ayrışmasını ve `enforced=false` bir işi
> CI'da kırmızı yakar.
>
> **2026-10-25 → 2026-11-23 arası `call-internal-job.sh` kullanan bütün işler hiç
> çalışmadı:** sunucu yeniden kurulunca sır dosyası yalnızca `docker-compose.env` olarak
> kaldı, betik `.env` arıyordu. Betik artık önce `docker-compose.env`'i, yoksa `.env`'i
> okur (`47dbe18f`). Düzeltmeden sonra her işin `lastSuccessAt`'i
> `/api/health/jobs` → `checks.scheduledJobs`'ta tazelenmeli.
>
> **2026-11-23:** `late-dropoff-scan` (5 dk) `close-expired-bookings`'in yerini aldı; eski
> iş ve ucu kaldırıldı. Sunucudaki crontab'da eski satır varsa silinip yenisi kurulmalı
> (`crontab -l` ile `ops/crontab.prod` karşılaştırması).

| İş | Cron (sunucu yerel saati) | Sarmalayıcı | Metot | Ne yapar |
|---|---|---|---|---|
| `generate-slots` | `17 4 * * *` | `generate-slots.sh` | POST | 30 gün ileriye slot üretir |
| `overdue-scan` | `47 4 * * *` | `overdue-scan.sh` | POST | Çıkış saati geçmiş açık rezervasyonlara olay yazar (durum değiştirmez) |
| `late-dropoff-scan` | `2,7,…,57 * * * *` (5 dk) | — | POST | Bırakma saatinde gelmeyen misafire +15/+30/+45 dk hatırlatma, +60 dk'da (ya da esnafın bekletmesi bitince) kapanış |
| `booking-reminders` | `7,22,37,52 * * * *` (15 dk) | — | GET | Yaklaşan check-in hatırlatması; geç teslimde esnaf/misafir uyarıları (`NotificationLog` ile tekrar kontrollü) |
| `consistency-check` | `41 5 * * *` | — | GET | Ayrışmış rezervasyon/dükkan kayıtlarını sayar (düzeltmez) |
| `cleanup` | `23 3 * * *` | — | POST | Süresi geçmiş token/oturum, 90 günden eski `AnalyticsEvent` ve `AppLinkHit` |
| `seal-forecast` | `37 6 * * 1` | — | POST | Mühür ihtiyacı öngörüsü |
| `classify-inbox` | `13 5 * * *` | — | POST | Gelen kutusunu destek/toplu/otomatik ayırır |
| `response-times` | `29 3 * * *` | — | POST | Dükkan "yanıt süresi" rozeti |
| `finance-export` | `53 2 * * *` | — | GET | Finans/mutabakat dışa aktarımı |

Bu tabloyu elle değil kayıt defterinden güncelleyin (`./scripts/emit-crontab.sh`).
**Metot da oradan gelir:** yalnızca `GET` export eden bir uca `POST` gönderen crontab
satırı **405** ile sessizce düşer.

Hepsi `call-internal-job.sh` üzerinden çalışır; sarmalayıcısı olan işlerde iş adı
sabitlenir. Sunucuya özgü işler (6 saatlik Postgres yedeği, günlük AWS maliyet raporu,
haftalık `docker image prune`) kayıt defterinde değil, `ops/crontab.prod`'un ikinci
bölümündedir. Loglar `/opt/emanetci/logs/` altında (`ec2-user`'ın `/var/log`'a yazma izni yok).

**Sağlık kontrolü:** `GET /api/health/jobs` — sır gerektirmez, sağlıksızsa **503**.
Herhangi bir HTTP izleyici bunu izleyebilir (`docs/GUVENLIK_VE_IZLEME.md`). Beş sinyal:

| Kontrol | Neyi ölçer | `stale`/`broken` ne demek |
|---|---|---|
| `slotGeneration` | slot ufkunun tazeliği | üretim ~2 gündür çalışmamış |
| `overdueReconciliation` | en eski açık rezervasyonun yaşı | 72 saati aşmış açık rezervasyon var |
| `sealIntegrity` | mühür sahiplik değişmezi | sahipsiz `ASSIGNED` veya dükkanlı `STOCK` mühür var |
| `partnerReachability` | partnerin ulaşılabilir kanalı | ne e-postası ne telefonu olan partner var |
| `scheduledJobs` | işlerin son başarılı çalışması | bir iş `maxStaleHours`'ı aşmış |

Biri bozuksa diğerleri **maskelemez** — toplam durum `DEGRADED` olur.

---

## Ön koşullar

- Sunucuda uygulama dizini `/opt/emanetci` (farklıysa `--app-dir`).
- `CRON_SECRET` sunucudaki `docker-compose.env`'de (SSM'den üretilir, `ops/SECRETS.md`).
  Betik değeri **çalışma anında** okur — crontab'a sır yazılmaz, çünkü `crontab -l`
  çalıştıran herkes görür. Dosya `ec2-user`'ın okuyabileceği izinle (640) üretilir.
- `curl` kurulu olmalı (betik kontrol eder).

## Bir işi elle çalıştırmak

```bash
cd /opt/emanetci
./scripts/overdue-scan.sh                                  # sarmalayıcılı iş
./scripts/call-internal-job.sh --job cleanup               # diğerleri
./scripts/call-internal-job.sh --job booking-reminders --method GET
./scripts/overdue-scan.sh --base-url https://staging.example.com --app-dir /srv/bagajpark
```

Beklenen (stderr, zaman damgalı): `INFO  BASARILI (HTTP 200): {...}`. Başarısızlıkta
çıkış kodu 1 ve sebep açıkça yazılır:

| HTTP | Anlamı |
|---|---|
| 401 | `CRON_SECRET` uyuşmuyor |
| 405 | Yanlış metot (kayıt defterindeki `method`'a bakın) |
| 503 | Uygulamada `CRON_SECRET` tanımsız |
| 404 | Uç kaldırılmış (ödeme mutabakat cron'unda böyle oldu, 2 ay fark edilmedi) |
| 000 | Bağlantı kurulamadı |

`overdue-scan` ve `classify-inbox` idempotenttir: ikinci koşu `eventsRecorded: 0` /
`classified: 0` döner. `classify-inbox` parti başına 500 mesaj işler; `moreToDo: true`
görürseniz `remaining` sıfırlanana kadar tekrar çalıştırın.

---

## Crontab'ı kurma ve güncelleme

İş tanımlarının tek kaynağı **`src/lib/jobs/registry.ts`**'tir. Crontab'ı elle yazmak,
kayıt defteriyle gerçeğin ayrılmasının ta kendisidir — slot üretiminin 37 gün, ödeme
mutabakat cron'unun 2 ay fark edilmeden durması bu yüzdendi.

**Yeni bir iş eklemek:** registry'ye `enforced: true` ile ekle (test başka değeri kabul
etmez) → `bash scripts/emit-crontab.sh` çıktısıyla `ops/crontab.prod`'un ilk bölümünü
güncelle → PR. Merge sonrası sunucuya kurulana kadar `/api/health/jobs` o işi gecikmiş
gösterir; bu bilinçli bir hatırlatıcıdır.

**Sunucuya kurmak** (`ec2-user` olarak; deploy `ops/crontab.prod`'u taşımaz, dosyayı
kopyalayın):

```bash
mkdir -p /opt/emanetci/logs                 # yoksa hiçbir iş çalışmaz
crontab -l > /tmp/crontab.yedek             # mevcut listeyi yedekle
crontab /tmp/crontab.prod                   # ops/crontab.prod'un kopyası
crontab -l | grep -c call-internal-job      # doğrula
```

**Geri alma:** `crontab /tmp/crontab.yedek`.

**Ertesi gün:**

```bash
curl -s https://bagajpark.com/api/health/jobs | jq '.checks.scheduledJobs.jobs[] | {job, lastSuccessAt, status}'
```

---

## Tek seferlik veri onarım betikleri

Hepsi aynı kalıpla çalışır: **varsayılan kuru çalışma** (hiçbir şey yazmaz) → **yedek
zorunlu** (`./scripts/backup.sh`, `ops/README.md`) → `--apply` → kuru çalışmayı tekrar
koşarak doğrulama. Neden ve kapsam her betiğin başlığında; `--help` her birinde çalışır.
Geri dönüş yolu yedektir — satır satır geri alınamazlar.

| Betik | Ne onarır | Not |
|---|---|---|
| `repair-seal-ownership.sh` | `STOCK` dışında olup dükkanı olmayan mühürleri `STOCK`'a alır (2026-08-22: 1.277 mührün 1.247'si sahipsiz `ASSIGNED`) | `--apply --validate` ile `Seal_ownership_matches_status` kısıtını da doğrular; canlıda uygulanıp uygulanmadığı `docs/BACKLOG.md` P1-7'de açık. Doğrulama: `/api/health/jobs` → `sealIntegrity` |
| `repair-slot-timezone.sh` | UTC'de üretilmiş yanlış saatli gelecek slotları siler (2026-08-24 saat dilimi hatası) | Rezervasyonlu ve geçmiş slotlara dokunmaz. **`--apply`'dan sonra `./scripts/generate-slots.sh` zorunlu**, yoksa saatlik ürün seçilemez |
| `repair-bypass-bookings.sh` | Çıkış saati geçmiş açık test (`bypass_`) rezervasyonlarını kapatır | Kapsam bilerek dar; ödemeyi `REFUNDED`'a alır |
| `repair-stale-checkin.sh` | Mühürsüz, ödemesiz, çıkışı çoktan geçmiş `CHECKED_IN` kayıtları `CANCELLED`'a alır | `BookingService` bu geçişi kasten reddettiği için veri onarımı olarak ayrı |

Bu betikler sunucuda `docker-compose.env` değil `--app-dir` altındaki `.env`'i bekliyor
(betik başlıkları); sunucuda `.env` yok, çalıştırmadan önce bağlantı değerini kontrol edin.

---

## Gelen kutusunu sınıflandırma

`destek@bagajpark.com`'a gelen her e-posta `ContactMessage` olarak yazılır ve **giriş
anında** sınıflandırılır; `classify-inbox` işi kalanları her gün süpürür. `/admin/messages`
varsayılan olarak yalnızca **Destek**'i gösterir. Kural `List-Unsubscribe` /
`Auto-Submitted` gibi başlıklara baktığı için SQL'de değil kodda tek kopya durur.

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
npx tsx scripts/prelaunch-points.ts --apply --open istanbul-taksim
```

### Nokta açıldığında — `--open`

`--open` **tek işlemde** iki şey yapar: `isPrelaunch = false` (nokta artık
rezervasyon alır) ve "açılınca haber ver" diyen herkese e-posta.

İkisi ayrılmadı çünkü ayrılsa biri unutulur — ve unutulan taraf hep bildirim
olur: nokta açılır, kimse haberdar edilmez, aylarca toplanan e-postalar hiçbir
işe yaramaz. Toplanmalarının tek sebebi o vaatti.

**Sıra kasıtlı:** önce `isPrelaunch = false`, sonra bildirim. Ters sırada,
e-postayı alıp gelen kişi hâlâ rezervasyon alamayan bir noktayla karşılaşırdı.
`notifyOpened` bu yüzden hâlâ prelaunch olan bir noktada **hiçbir şey
göndermeyi reddediyor** — yanlış sırayla çağrılan bir betik yüzlerce kişiye boş
vaat gönderemesin diye.

**İdempotent.** Yalnızca `PrelaunchInterest.notifiedAt` boş olanlara gönderir ve
gönderdiğini damgalar; başarısız olan damgalanmaz, bir sonraki koşuda tekrar
denenir. Bir pazarlama e-postasını iki kez göndermek, hiç göndermemekten daha
çok zarar verir.

Kuru çalışma kaç kişinin haber beklediğini yazar:

```
[kuru] acilacak: Tour Eiffel — Consigne à Bagages
  haber bekleyen: 2 kisi
Yazmak icin: --apply
```

Ölçüldü (2026-08-31, yerel): ilk koşu 2 kişiye gönderdi ve damgaladı; ikinci
koşu `gonderildi 0, daha once bildirilmis 2` dedi.

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

### Üretime yazma

İlk yükleme 2026-08-31'de yapıldı (482 nokta / 252 şehir; ikinci kuru çalışma
`Olusturulacak: 0` — idempotentlik üretimde de ölçüldü). **Sıra önemliydi:** önce
`OPERATING_SHOP_FILTER` düzeltmesi deploy edildi, sonra noktalar yazıldı; ters sırada
kamuya açık sayılar kısa süre noktaları da sayardı.

Üretim Postgres'i dışarı açık değil (`127.0.0.1:5433`) ve sunucudaki imajda `scripts/` ile
`src/` yok (`Dockerfile`), yani betik **yerelden, SSH tüneliyle** koşar. Bağlantı değerini
`docker-compose.env`'den değil, çalışan `web` konteynerinden alın — compose `DATABASE_URL`'i
`POSTGRES_*`'dan orada kurar. Değer ekrana basılmaz, doğrudan değişkene girer.

```bash
source ops/server.env    # SSH_HOST / SSH_PORT / SSH_USER / SSH_KEY_PATH
ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" -f -N -L 15433:127.0.0.1:5433 "$SSH_USER@$SSH_HOST"
export DATABASE_URL=$(ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" \
  "docker exec emanetci-web-1 printenv DATABASE_URL" | sed -E 's#@[^/]+/#@127.0.0.1:15433/#')

npx tsx scripts/prelaunch-points.ts --city istanbul            # kuru: OLUSTUR / guncelle
npx tsx scripts/prelaunch-points.ts --apply --city istanbul    # ilk yazan adım
npx tsx scripts/prelaunch-points.ts --city istanbul            # doğrula: Olusturulacak: 0

unset DATABASE_URL; pkill -f "15433:127.0.0.1:5433"
```

Şehir sayfası (`/tr/luggage-storage/<şehir>`) en geç 5 dakikada yeni noktayı "Yakında"
rozetiyle gösterir (`revalidate = 300`). Geri alma: `--apply --close <key>-<slug>` noktayı
silmez, gizler (`isActive = false`); toplanan talep verisi durur.

## UI/UX regresyon taraması — `ux-sweep.mjs`

```bash
node scripts/ux-sweep.mjs                          # canlıya karşı
BASE_URL=http://localhost:3000 node scripts/ux-sweep.mjs
SHOP_ID=<uuid> node scripts/ux-sweep.mjs           # dükkan/checkout için başka nokta
HEADLESS=1 node scripts/ux-sweep.mjs               # başsız (Cloudflare'e takılabilir)
```

**Ne yapar:** 11 misafir sayfasını iki koşulda (normal boyut ve `%200 metin`)
gerçek bir mobil viewport'ta gezip yedi kuralı doğrular:

| Kural | Neden |
|---|---|
| Yatay kaydırma yok | Sayfanın yana oynaması; DE/FR'de üç kez çıktı |
| Tek `main` | 25 dosyada iç içe `main` vardı; "ana içeriğe git" belirsizleşiyordu |
| Tek görünür `h1` | Arama sayfasında mobilde hiç `h1` yoktu |
| Başlık seviyesi atlaması yok | `h2→h4` dört sayfada vardı |
| Etiketsiz `nav` yok | Üç-dört işaret arasında ayırt edilemiyordu |
| Ekran okuyucuya İngilizce metin yok | Takvim ve harita her dilde İngilizce konuşuyordu |
| Dokunma hedefi ≥ 24×24 (WCAG 2.5.8) | Menü 12 px, footer 17 px'di |

**Çıkış kodu 1** kural bozulursa — bir cron ya da CI adımı buna bakıp alarm
üretebilir.

**Neden var:** bu kuralların hepsi 2026-08-31 UX denetiminde (`docs/UX_AUDIT.md`, git geçmişinde) kanıtıyla kayıtlı
gerçek hatalardan geliyor ve **hiçbiri gözle bakınca görünmüyordu** — 2 px'lik
kayma, ekran okuyucuya İngilizce konuşan takvim, güvenli bölgeyi aşan PWA
ikonu. Geri sızmalarının tek güvencesi tekrar ölçmek.

**Bilinen sınır:** Cloudflare bot doğrulaması ara sıra araya giriyor. Tarama
bunu tespit edip o sayfayı `atlandı` olarak işaretler — sessizce geçmez, çünkü
kapsamın daraldığı görünmeli.

## Esnaf aday listesi — `find-esnaf-leads.ts`

Pilot bölgede (Galata/Karaköy, bkz. `docs/BUYUME.md` § 8.2)
telesatış için aranacak esnaf adaylarını Google Places API'den toplu çeker:
isim, adres, telefon, website, puan → CSV. **E-posta yok** — Places API hiçbir
planda e-posta alanı döndürmez; plan zaten telefonla aramayı öngörüyor.

### 1. Places API anahtarı (bir kere kurulur)

1. https://console.cloud.google.com/ → sağ üstten bir proje seçin/oluşturun
   (örn. `emanetcim-leads`).
2. Sol menü → **APIs & Services → Library** → `Places API (New)` arayın →
   **Enable**. (Legacy "Places API" DEĞİL — "New" olan.)
3. Sol menü → **Billing** → bu projeye bir fatura hesabı bağlayın. Kredi kartı
   istenir ama **1.000 çağrıya kadar ücretsiz** (Enterprise SKU — telefon/
   website/puan bu SKU'da; 2026-09,
   `developers.google.com/maps/billing-and-pricing/pricing`). Bu script'in tek
   koşusu ~6 çağrı; pilot bölge için tek kuruş çıkmaz — kart yalnızca doğrulama
   için gerekiyor.
4. **APIs & Services → Credentials → Create Credentials → API key.**
5. Anahtarı oluşturduktan sonra **Edit API key**: *API restrictions* →
   *Restrict key* → sadece `Places API (New)` işaretli kalsın. Kısıtlamadan
   bırakılan bir anahtar başka bir Google servisinde de kullanılabilir hale
   gelir.
6. `.env`'e ekleyin (repo'da `.env*` gitignore'lu, commit'e girmez):
   ```
   GOOGLE_MAPS_API_KEY=AIza...
   ```

### 2. Çalıştırma

```bash
npx tsx scripts/find-esnaf-leads.ts
```

**Beklenen çıktı:** `Aranıyor: kafe...` gibi 6 satır, ardından
`N benzersiz aday → scripts/output/esnaf-leads-galata-karakoy.csv`. Dosya
git'e girmez (`.gitignore`) — telefon içeren toplu çıktı kaynak değil, yan
üründür; her koşuda yeniden üretilir.

Farklı bir şehir/bölge için CLI bayrakları kullanılır:

```bash
npx tsx scripts/find-esnaf-leads.ts --city "Bodrum" --lat 37.0344 --lng 27.4305 --limit 30
```

- `--city` arama sorgusuna eklenen ad (varsayılan: Galata-Karaköy)
- `--lat` / `--lng` merkez koordinat (verilmezse Galata Kulesi kullanılır)
- `--radius` metre cinsinden arama yarıçapı (varsayılan 700)
- `--limit` çıktıyı ilk N benzersiz adayla sınırlar
- `--out` çıktı dosyası (verilmezse `scripts/output/esnaf-leads-<şehir-slug>.csv`)
- `--categories` virgülle ayrılmış kategori listesi; o koşu için varsayılan
  `CATEGORIES` sabitinin yerine geçer (örn. rakip emanet noktalarını bulmak için
  `--categories "valiz emanet,bagaj depolama,luggage storage"`)

Varsayılan kategori listesini kalıcı değiştirmek için dosyanın başındaki
`CATEGORIES` sabitini düzenleyin — tek yerde, kodun ortasına gömülü değil.

### Sınırlar

- **E-posta hiç yok.** Places API'nin hiçbir SKU'sunda e-posta alanı
  bulunmuyor; website URI'si dönüyor, e-posta oradan elle/ayrı bir adımla
  çıkarılmalı.
- **30 günlük önbellek sınırı (Google ToS).** Bu CSV'yi kalıcı bir esnaf
  veritabanı gibi saklamayın — telesatış için bir kerelik arama listesi olarak
  kullanıp süresi geçince yeniden koşun.
- **Places sonuçlarıyla soğuk arama yapılırken KVKK** uygulanır; script veriyi
  Google'dan çekmekle sınırlı, arama/pazarlama tarafı ayrı bir uyum konusu.

## Günlük AWS maliyet raporu — `aws-cost-report.sh`

Prod EC2'de her gün 06:05 UTC (09:05 TR) çalışır ve e-postayla şunları gönderir: dünkü
brüt harcama, ay toplamı, günlük ortalama, kalan free tier kredisi, "bu hızla kredi ne zaman
biter" tahmini ve plan bitiş tarihi. Free plan'da kredi biterse hesap kapanır; bu e-posta
o kesintinin erken uyarısıdır. (2026-10-25 hesap taşımasının sebebi tam buydu,
`infra/aws/README.md`.)

Yetki EC2 rolünden gelir (`infra/aws/stack/main.tf` → `app_cost_read`: salt okur
`ce:GetCostAndUsage`, `freetier:GetAccountPlanState`). Sunucuda statik anahtar yok.
Resend anahtarı sunucunun `docker-compose.env`'inden okunur; alıcı SSM'de durur
(`/bagajpark/env/app/COST_REPORT_TO`), repo public olduğu için adres git'e yazılmaz.
Cost Explorer istek başına $0.01; günlük koşu ayda ~$0.60.

### Kurulum (bir kere)

Önkoşul: canlı hesaba (`infra/aws/README.md`) yazma yetkili bir AWS kimliği; komutlar repo
kökünden. Profil adı sizin yerel ayarınızdır.

1. Alıcıyı SSM'e yaz:
   ```bash
   aws ssm put-parameter --profile <prod-profiliniz> --region eu-central-1 \
     --name /bagajpark/env/app/COST_REPORT_TO --type String \
     --value 'alici@ornek.com' --overwrite
   ```
   Beklenen: `{"Version": 1, "Tier": "Standard"}`.
2. IAM iznini uygula: `infra/aws/stack` içinde `terraform plan` → yalnızca
   `aws_iam_role_policy.app_cost_read` **create** görünmeli → `terraform apply`.
3. Script'i sunucuya taşı: PR birleşince deploy `scripts/`'i `/opt/emanetci/scripts/`e
   senkronlar.
4. Crontab'ı kur: `ops/crontab.prod` başındaki KURULUM adımları (önce mevcut listeyi yedekle).

### Doğrulama

Yerelde, prod kimliğiyle, göndermeden:
```bash
scripts/aws-cost-report.sh --dry-run --no-log-file --to test@ornek.com
```
Beklenen: `dun (YYYY-MM-DD): $… | ay toplami: $… | plan: FREE <kredi> <bitis>` ve
e-postanın metni.

Sunucuda bir kez elle (SSM Run Command ya da oturumla, `ec2-user` olarak):
```bash
/opt/emanetci/scripts/aws-cost-report.sh --log-file /opt/emanetci/logs/aws-cost-report.log
```
Beklenen son satır: `e-posta gonderildi`. `Resend HTTP 403` → gönderici alan adı
doğrulanmamış ya da anahtar yanlış; `AccessDenied` (ce/freetier) → 2. adım uygulanmamış.

### Geri alma

`ops/crontab.prod`'dan satırı sil ve crontab'ı yeniden kur. İzin zararsızdır
(salt okuma), ama kaldırmak için `app_cost_read` bloğunu silip `terraform apply`.

---

## Diğer betikler (kısa dizin)

| Betik | Ne | Ayrıntı |
|---|---|---|
| `backup.sh`, `backup-s3.sh`, `restore.sh` | Postgres yedeği, S3 kopyası, geri yükleme | `ops/README.md` |
| `secrets-render.sh`, `secrets-remote.sh`, `secrets-put.sh`, `tls-put.sh` | SSM sırları ve TLS materyali | `ops/SECRETS.md` |
| `update.sh` | CI yokken sunucuda elle güncelleme (GHCR `latest`) | `ops/README.md` |
| `docker-entrypoint.sh` | Konteyner başlangıcı: `prisma migrate deploy`, sonra sunucu | `docs/GELISTIRME.md` |
| `verify-migrations.sh` | `npm run db:verify` — geçici DB'de migrasyon ↔ şema sapması | — |
| `audit-deps.mjs` | `npm run audit` — prod bağımlılığında yüksek/kritik açık kapısı | `docs/GELISTIRME.md` |
| `check-internal-links.mjs` | `npm run link-check` — çalışan sunucuda yaygın misafir yollarına GET (Markdown'ı denetlemez) | — |
| `copy-maplibre-worker.mjs` | `predev`/`prebuild`: MapLibre worker'ını `public/`'e kopyalar | — |
| `create-user.sh` | `/api/admin/setup` ile kullanıcı oluşturur/günceller (`ADMIN_SETUP_KEY`) | betik başlığı |
| `blog-city-posts.ts`, `blog-images.ts`, `prelaunch-city-index.ts` | Şehir blog yazıları ve görselleri | betik başlıkları |
| `generate-brand-assets.mjs`, `pwa-screenshots.mjs` | Marka görselleri, PWA ekran görüntüleri | betik başlıkları |
| `load-test.k6.js` | Tek dosyalık k6 yük testi | `tests/stress/README.md` |
| `local-ci.sh`, `pre-commit.sh` | `act` ile yerel CI, pre-commit kancası | betik başlıkları |
| `vm-update.sh` | Hetzner/LAN VM dönemi: `develop`'u çekip yerinde derler | **eski** — canlı sunucuda kullanmayın, `update.sh` kullanın |
