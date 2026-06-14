# PRD / Operasyon ↔ Kod (özet matris)

| Alan | Durum | Not |
|------|--------|-----|
| Next.js App Router | Tam | Next.js **16**, edge proxy dosyası **`src/proxy.ts`** (`export function proxy`) |
| i18n (TR/EN) | Tam | `next-intl` |
| RBAC (admin/partner) | Tam | Auth.js + `proxy` yönlendirmeleri |
| Arama + mesafe | Tam | Haversine (`ShopService.findNearby`), harita **MapLibre** + OSM |
| Filtreler (puan, fiyat, 7/24, WC) | Tam | `SearchClient` + şema alanları `open247`, `hasRestroom` |
| Kupon | Tam | `Coupon` + checkout’ta kod |
| Webhook imza | Tam | `X-IYZ-SIGNATURE-V3`; HMAC mesajında `paymentConversationId` veya `conversationId` (Direct + HPP) |
| E-posta | Kısmi | `RESEND_API_KEY` ile gerçek gönderim; yoksa log |
| SMS | Kısmi | Log / genişletilebilir sağlayıcı |
| QR güvenliği | Tam | JWT (`jose`), süre **48h** |
| Check-in saat kontrolü | Tam | `isShopOpenAt` |
| Dispute | Tam | Misafir formu + admin not alanı için API hazır |
| Admin mühür / kampanya | Tam | `SealRequest`, `Campaign` + listeler |
| Prod env doğrulama | Kısmi | `lib/env.ts` + `instrumentation.ts` |
| Feature flags | Tam | `FeatureFlag` + `/admin/feature-flags`; `payments_enabled` + env `PAYMENTS_ENABLED=false` (anında kapatma) |

Dokümanlardaki sigorta/hukuki süreçler iş kuralı metnidir; operasyonel onay ayrıdır.
