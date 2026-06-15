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

## Önerilen metrikler / paneller

Üretimde aşağıdakiler için sayaç veya histogram tanımlanması önerilir (Prometheus, Datadog, CloudWatch vb.):

| Metrik | Kaynak |
|--------|--------|
| `payment_init_total` / `payment_init_errors` | `PaymentService.initializeMarketplacePayment` |
| `reconcile_fixed_bookings` | `reconcileStalePaymentBookings` |
| `notification_send_errors` | `NotificationService` |

Finansal ledger davranışı: [FINANCE_LEDGER.md](./FINANCE_LEDGER.md).
