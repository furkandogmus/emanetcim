# Observability (log sözlüğü ve metrikler)

## Yapılandırılmış log alanları

Sunucu tarafında [`src/lib/logger.ts`](../src/lib/logger.ts) (Pino) kullanılır. Üretimde JSON satırları; şu alanlar tutarlı kullanılmalıdır:

| Alan | Açıklama |
|------|----------|
| `bookingId` | Rezervasyon UUID |
| `conversationId` / `paymentConversationId` | Ödeme konuşma / merchant ref |
| `requestId` | HTTP `x-request-id` (edge/proxy ile) |
| `err` | Hata nesnesi (Pino `err` serializer) |
| `service` | Sabit: `emanetci` (logger `base`) |
| `env`, `version` | Ortam ve sürüm (deploy) |

### Örnek mesaj anahtarları

- `finance_reconcile_pending_to_paid` — reconciliation satırı düzeltildi
- `reconcile_payments_complete` — toplu reconcile job özeti
- `request_error` — [`instrumentation.ts`](../instrumentation.ts) `onRequestError`

## Global hata yüzeyi

Kök [`src/app/global-error.tsx`](../src/app/global-error.tsx) beklenmeyen istemci hatalarında kullanıcıya “Tekrar dene” sunar.

## Sağlık uçları — hangisi neyi söyler

| Uç | Neye bakar | Sağlıksızsa |
|---|---|---|
| `/api/health/live` | Süreç ayakta mı (DB'ye dokunmaz) | — |
| `/api/health` | Postgres + Redis erişilebilir mi | `503` |
| `/api/health/jobs` | **Zamanlanmış işler gerçekten çalışıyor mu** | `503` |

**Neden üçüncüsü ayrı bir uç:** slot üretimi 2026-07-14'te durdu ve 37 gün fark
edilmedi. O süre boyunca Postgres ve Redis sapasağlamdı, yani `/api/health` yeşil
yanıyordu. **Altyapı sağlığı ile iş sağlığı aynı şey değildir** ve bu kesintiyi
yalnızca ikincisi yakalar.

`/api/health/jobs` tazeliği ek bir kayıt tutmadan ölçer: üretim her çalıştığında
30 gün ileriye slot yazar, çalışmadığı her gün bu ufuk 1 gün kısalır. Yani
`ufuk = 30 − son_çalışmadan_beri_geçen_gün`. Ufuk 28 günün altına inerse (iş ~2
gündür çalışmıyor) uç `503` döner.

Uç **kasıtlı olarak herkese açık ve sırsızdır** — böylece herhangi bir HTTP izleyici
alarm verebilir. Ayrıca hiç aktif dükkan yoksa `not_applicable` döner ve susar;
sürekli kırmızı yanan bir kontrol, hiç olmayandan daha kötüdür.

### İzlemeyi bağlamak

Alarmı kuracak servis bir hesap gerektirdiği için **henüz açılmadı**; yapılandırma
tarafı (aşağıdaki rate limit) hazır. Servis seçimi: **UptimeRobot** ücretsiz
kademesi ikisi için de yeter ve dışarıya bağımlılık yaratmaz. Domain Cloudflare'de
olduğu için oradaki Health Checks de bir seçenektir — hangi planda olduğuna bağlı,
kontrol edilmeli. Üçüncü bir seçenek `healthchecks.io` "dead man's switch"
mantığıdır: cron her çalıştığında ping atar, atmazsa alarm çalar
(`generate-slots.sh` sonuna bir `curl` satırı yeterli) — bu, aşağıdaki iki monitörün
*yerine* değil, yanına konur.

**Kurulacak iki monitör — aralık, sinyalin ritmine göre seçilir.** Tek bir URL'i
sık sık sormak değil, iki farklı soruyu iki farklı sıklıkta sormak gerekiyor:

| Monitör | URL | Aralık | Maliyeti |
|---|---|---|---|
| Ayakta mı | `https://bagajpark.com/api/health/live` | 1–5 dk | **0 sorgu** |
| İşler çalışıyor mu | `https://bagajpark.com/api/health/jobs` | **30 dk** | ~18 sorgu/çağrı |

İkisi de `503`'te alarm verecek şekilde ayarlanır (HTTP durum kontrolü).

**Neden `jobs` 5 dakikada bir DEĞİL:** bu ucun ölçtüğü her şey *günlük* ritimde
değişir — slot ufku günde 1 gün kısalır, gecikme saatle ölçülür ve kritik eşik 72
saattir. 5 dakikalık aralık, 30 dakikalıktan tek bir ek bilgi üretmez ama
veritabanına 6 kat yük bindirir. 30 dakikada bir = günde 48 çağrı ≈ 900 sorgu,
yani birkaç sayfa açılışı kadar.

**Neden `live` ayrı bir monitör:** hiç veritabanına dokunmaz ve nginx'te kendi
`location`'ı vardır (`access_log off`). "Site ayakta mı" sorusunun cevabı bu;
`jobs` ise "ayakta ama iş görüyor mu" sorusunun cevabı. İkisi farklı arızalarda
kırmızı yanar ve 2026-07-14'teki kesinti tam olarak ikincisiydi.

### `/api/health/jobs` kendi rate limit'ini taşır (2026-08-30)

Uç **kimlik doğrulamasız ve herkese açıktır** — bu bilinçlidir, sır bilmeyen bir
izleyicinin alarm verebilmesi için. Ama tek çağrıda ~18 sorgu koşar (`seal.count()`
gibi tam tablo sayımları dahil) ve `api_general` limiti altında (30r/s, burst 120)
tek bir IP veritabanına **saniyede ~540 sorgu** yaptırabiliyordu.

Kendi zone'u eklendi: `api_health`, IP başına **12r/m** (`nginx/conf.d/01-hardening.conf`),
`burst=6 nodelay` ile `location = /api/health/jobs`'a bağlı (`nginx/conf.d/default.conf`).
30 dakikada bir soran bir izleyici ve olay anında elle `curl` atan bir insan için
fazlasıyla geniş; kaba kuvvet için değil. **`/api/health/live` kapsam dışı** —
sıfır sorgu koşar ve nginx'in kendi konteyner healthcheck'i onu 5 saniyede bir
çağırır; limitlenirse konteyner `unhealthy` düşer.

### Uygulama ve doğrulama (sunucuda)

Nginx yapılandırması repodan gelir; deploy sonrası **reload'dan ÖNCE** sözdizimi
doğrulanır:

```bash
cd /opt/emanetci && docker compose exec nginx nginx -t
```

Beklenen çıktı — bu iki satır, başka bir şey değil:

```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Sonra devreye al ve limitin gerçekten uygulandığını ölç:

```bash
docker compose exec nginx nginx -s reload
for i in $(seq 1 10); do \
  curl -s -o /dev/null -w '%{http_code} ' https://bagajpark.com/api/health/jobs; \
done; echo
```

Beklenen: ilk ~6 istek `200`, kalanlar `429`. Hepsi `200` gelirse limit
bağlanmamıştır (büyük ihtimalle `location` bloğu `location /`'un altında kalmıştır
— tam eşleşme `=` bu yüzden kullanıldı). Konteyner sağlığı da bozulmamalı:

```bash
docker compose ps --format '{{.Service}} {{.Status}}'
```

Beklenen: `nginx` ve `web` satırlarında `(healthy)`.

**Kurulu olan diğer tek şey:** `generate-slots.sh` başarısızlıkta non-zero çıkıyor ve
crontab satırındaki log dosyasına yazıyor (`/opt/emanetci/logs/`). **Kimse log'a
bakmıyorsa bu sessizdir** — yukarıdaki iki monitör kurulana kadar 2026-07-14'te
yaşanan hatanın aynısı bir kademe yukarıda hâlâ mümkün.

## Önerilen metrikler / paneller

Üretimde aşağıdakiler için sayaç veya histogram tanımlanması önerilir (Prometheus, Datadog, CloudWatch vb.):

| Metrik | Kaynak |
|--------|--------|
| `payment_init_total` / `payment_init_errors` | `PaymentService.initializeMarketplacePayment` |
| `reconcile_fixed_bookings` | `reconcileStalePaymentBookings` |
| `notification_send_errors` | `NotificationService` |

Finansal ledger davranışı: [FINANCE_LEDGER.md](./FINANCE_LEDGER.md).
