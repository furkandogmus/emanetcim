# Finans ve ledger (Booking ↔ PaymentLog)

## Durum makinesi (özet)

| Booking.status | PaymentLog.status | Beklenen |
|----------------|-------------------|----------|
| `PENDING` | yok / `FAILED` | Ödeme bekleniyor veya başarısız |
| `PENDING` | `SUCCESS` | **Tutarsızlık** — webhook gecikmesi; reconciliation `PAID` yapar |
| `PAID`+ | `SUCCESS` | Normal |

## Reconciliation

- **Ne zaman:** Webhook geciktiğinde veya ödeme sonrası booking güncellemesi kaçtığında.
- **Ne yapar:** `status = PENDING` ve ilişkili `PaymentLog.status = SUCCESS` olan kayıtları `PAID` yapar.
- **Kod:** `PaymentService.reconcileStalePaymentBookings()`
- **Tetikleme:** `POST /api/internal/reconcile-payments` — `Authorization: Bearer <CRON_SECRET>` veya `x-cron-secret: <CRON_SECRET>`. Ortamda `CRON_SECRET` tanımlı olmalı.

Önerilen zamanlama: her 1–5 dakikada bir (cron, Kubernetes CronJob, Vercel Cron vb.).

## CSV dışa aktarma (operasyon)

- **Uç:** `GET /api/internal/finance-export?days=90` — `Authorization: Bearer <CRON_SECRET>` veya `x-cron-secret: <CRON_SECRET>`.
- **Çıktı:** Rezervasyon özeti + ödeme durumu + `chargebackStatus` (varsa).


- Timeout durumunda hata loglanır; istemci tarafında yeniden deneme / kullanıcıya mesaj iş kurallarına bırakılır.

## Log alanları

Yapılandırılmış log için bkz. [OBSERVABILITY.md](./OBSERVABILITY.md) — `bookingId`, `paymentId` / `conversationId`, `requestId`.
