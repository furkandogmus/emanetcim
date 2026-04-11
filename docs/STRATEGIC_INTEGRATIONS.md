# Stratejik entegrasyonlar (OTA, affiliate, sigorta, native)

Bu belge Faz 6 kapsamında ürün kararına bağlı genişlemeler için çerçevedir; kodda yer tutucu env anahtarları ve API yüzeyi ileride netleştirilir.

## OTA / otel kanalı

- **Hedef:** Booking.com / otel PMS veya white-label ortak girişleri.
- **Öneri:** Ayrı `PartnerApiKey` modeli, imzalı webhook giden olaylar (`booking.created`, `booking.checked_out`), rate limit ve IP allowlist.
- **Env (örnek):** `OTA_WEBHOOK_SECRET`, `HOTEL_PARTNER_BASE_URL` — üretimde vault.

## Affiliate / yönlendirme

- **Hedef:** İş ortağı kampanya kodları ve komisyon raporu.
- **Öneri:** `Affiliate` + `AffiliateAttribution` (cookie veya `?ref=`); mevcut `Coupon` ile birleştirilebilir.
- **Env (örnek):** `AFFILIATE_DEFAULT_COMMISSION_BP` (basis points).

## Sigorta ortağı

- **Hedef:** Seyahat / emanet sigortası poliçesi satışı veya yönlendirmesi.
- **Öneri:** Harici sigorta API’si veya manuel poliçe no alanı; `Booking` üzerinde `externalPolicyRef` (gelecek migration).
- **Env (örnek):** `INSURANCE_PARTNER_API_URL`, `INSURANCE_PARTNER_API_KEY`.

## Native uygulama (iOS / Android)

- **Hedef:** Mağaza uygulaması veya Capacitor/TWA kabuğu.
- **Öneri:** Mevcut web oturumu + derin bağlantılar; push için sunucu tarafında Web Push (VAPID) veya FCM ayrı kanal.
- **Not:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` ile web push zaten desteklenir; native için ayrı SDK entegrasyonu gerekir.

İlgili üretim checklist: [PRODUCTION_BACKLOG.md](./PRODUCTION_BACKLOG.md).
