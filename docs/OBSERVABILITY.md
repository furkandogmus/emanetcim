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

### İzlemeyi bağlamak (ücretsiz seçenekler, hesap gerektirir)

Sinyal hazır; alarmı kuracak servis bir hesap gerektirdiği için **açılmadı** —
seçim senin. Üçü de ücretsiz kademede yeter:

1. **Cloudflare Health Checks / Worker cron** — domain zaten Cloudflare'de,
   ek servis yok. `https://bagajpark.com/api/health/jobs` adresini izleyip
   `503`'te bildirim gönderir.
2. **UptimeRobot** (ücretsiz: 50 monitör, 5 dk aralık) — en hızlı kurulum. Aynı
   URL'i ekle, "keyword/HTTP status" kontrolü seç.
3. **Healthchecks.io** (ücretsiz) — "dead man's switch" mantığı: cron her
   çalıştığında ping atar, atmazsa alarm çalar. `generate-slots.sh` sonuna bir
   `curl` satırı eklemek yeterli.

Şu an kurulu olan tek şey: `generate-slots.sh` başarısızlıkta non-zero çıkıyor ve
`/root/emanetci/slots.log`'a yazıyor. **Kimse log'a bakmıyorsa bu sessizdir** —
bugün çözülen hatanın aynısı bir kademe yukarıda hâlâ mümkün.

## Önerilen metrikler / paneller

Üretimde aşağıdakiler için sayaç veya histogram tanımlanması önerilir (Prometheus, Datadog, CloudWatch vb.):

| Metrik | Kaynak |
|--------|--------|
| `payment_init_total` / `payment_init_errors` | `PaymentService.initializeMarketplacePayment` |
| `reconcile_fixed_bookings` | `reconcileStalePaymentBookings` |
| `notification_send_errors` | `NotificationService` |

Finansal ledger davranışı: [FINANCE_LEDGER.md](./FINANCE_LEDGER.md).
