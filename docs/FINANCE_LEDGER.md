# Finans ve ledger (Booking ↔ PaymentLog)

## Durum makinesi (özet)

| Booking.status | PaymentLog.status | Beklenen |
|----------------|-------------------|----------|
| `PENDING` | yok / `FAILED` | Ödeme bekleniyor veya başarısız |
| `PENDING` | `SUCCESS` | **Tutarsızlık** — webhook gecikmesi; reconciliation `PAID` yapar |
| `PAID`+ | `SUCCESS` | Normal |
| iptal/iade akışları | `REFUNDED` / `FAILED` | `BookingService` + iyzico iade |

## Reconciliation

- **Ne zaman:** Webhook geciktiğinde veya ödeme sonrası booking güncellemesi kaçtığında.
- **Ne yapar:** `status = PENDING` ve ilişkili `PaymentLog.status = SUCCESS` olan kayıtları `PAID` yapar.
- **Kod:** `PaymentService.reconcileStalePaymentBookings()`
- **Tetikleme:** `POST /api/internal/reconcile-payments` — `Authorization: Bearer <CRON_SECRET>` veya `x-cron-secret: <CRON_SECRET>`. Ortamda `CRON_SECRET` tanımlı olmalı.

Önerilen zamanlama: her 1–5 dakikada bir (cron, Kubernetes CronJob, Vercel Cron vb.).

## CSV dışa aktarma (operasyon)

- **Uç:** `GET /api/internal/finance-export?days=90` — `Authorization: Bearer <CRON_SECRET>` veya `x-cron-secret: <CRON_SECRET>`.
- **Çıktı:** Rezervasyon özeti + ödeme durumu + `chargebackStatus` (varsa).

## iyzico çağrıları

- `initializeMarketplacePayment` ve `refundPayment` içindeki iyzico SDK çağrıları `withTimeout` ile sarılıdır (varsayılan **45s**, `IYZICO_HTTP_TIMEOUT_MS` ile değiştirilebilir).
- Timeout durumunda hata loglanır; istemci tarafında yeniden deneme / kullanıcıya mesaj iş kurallarına bırakılır.

## Webhook

- `/api/payments/webhook` — imza doğrulama ve rate limit uygulanır.
- Başarılı işlemden sonra booking ödeme durumu güncellenir; buna rağmen tutarsızlık kalırsa reconciliation devreye girer.

## Log alanları

Yapılandırılmış log için bkz. [OBSERVABILITY.md](./OBSERVABILITY.md) — `bookingId`, `paymentId` / `conversationId`, `requestId`.
