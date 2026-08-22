# Canlıya çıkış (go-live) eksik listesi

> 2026-06-10 denetimi. Geniş kapsamlı liste için [PRODUCTION_BACKLOG.md](PRODUCTION_BACKLOG.md); bu dosya **lansmanı bloklayan asgari** maddeler içindir. Pazarlama/reklam planı: [`marketing/MARKETING_PLAN.md`](../marketing/MARKETING_PLAN.md).

## Beta lansman planı (karar: 2026-06-10)

Beta **ödemesiz** çıkar: `PAYMENTS_ENABLED=false` (env kill switch) + `NEXT_PUBLIC_BETA_BADGE=true` (header rozeti). Rezervasyon akışı çalışır, online ödeme adımı kapalıdır; fiili ödeme dükkânda elden yapılır. Esnaf kayıtları beta ile başlar.

- **Esnaf sözleşmesi:** Komisyon oranı sözleşmeye şimdiden yazılır; "beta süresince komisyon alınmaz" açıkça belirtilir. Elden ödeme alışkanlığı kalıcılaşmadan beklenti kurulur.
- **Betadan çıkış kriterleri (ödeme açılır):**
  - [ ] 50 aktif nokta
  - [ ] 100 sorunsuz rezervasyon (iptal/şikâyet hariç, uçtan uca tamamlanmış)
  - [ ] Esnaf onboarding'inde bilinen tıkanma kalmaması

## A. Bloklayanlar (bunlar olmadan açılmaz)

- [ ] **Domain + TLS:** `bagajpark.com` DNS, Nginx sertifika (Let's Encrypt) ve 80→443 yönlendirme; `AUTH_PUBLIC_HOST` + `PUBLIC_URL_PROTOCOL=https`.
- [ ] **`NEXT_PUBLIC_BASE_URL=https://bagajpark.com`:** Boş kalırsa canonical, hreflang ve sitemap **localhost** üretir — SEO'yu kökten bozar. (Şablona eklendi: `docker-compose.env.example`.)
- [ ] **Üretim secret'ları:** `AUTH_SECRET`, güçlü `POSTGRES_PASSWORD`, `ADMIN_SETUP_KEY`, `CRON_SECRET`; `.env` asla repoya girmez.
- [ ] **Google OAuth:** Cloud Console'da prod redirect URI (`https://bagajpark.com/api/auth/callback/google`).
- [ ] **E-posta (SMTP) + Netgsm:** Şifre sıfırlama, rezervasyon onayı, esnaf SMS'i prod kimlik bilgileriyle test edilmiş.
- [ ] **Veritabanı:** Yönetilen Postgres veya VM'de `DATABASE_SSL=true`; `prisma migrate deploy` + seed (`PlatformSettings` default satırı); **otomatik yedek + bir kez geri yükleme tatbikatı**.
- [ ] **Lokal build doğrulaması:** `npm run build` lokalde `DATABASE_URL` ister (`/api/admin/setup` page-data). CI Postgres'le geçiyor; deploy pipeline'ında da DB erişimi olduğundan emin olun.

## B. Lansman günü (SEO/ölçüm — kod hazır, operasyon eksik)

- [ ] **Google Search Console:** Domain property aç → `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` env'ini doldur (meta tag desteği eklendi) → `sitemap.xml` gönder.
- [ ] **Bing Webmaster Tools:** GSC'den içe aktar (5 dk).
- [ ] **Plausible:** `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=bagajpark.com`; `booking_paid`, `partner_apply` custom event hedefleri.
- [ ] **Redis rate limit:** `REDIS_URL` (compose varsayılanı `redis://redis:6379`) + `REQUIRE_DISTRIBUTED_RATE_LIMIT=true` (login/ödeme brute-force koruması).
- [ ] **Synthetic monitoring:** UptimeRobot vb. ile `/tr`, `/api/health` (varsa) ping + SSL süre uyarısı.

## C. İlk hafta (bloklamaz ama erken yapılmalı)

- [ ] **Güvenlik başlıkları:** Nginx'te `HSTS`, `X-Frame-Options`, `Referrer-Policy`, temel CSP (backlog §1).
- [ ] **Şehir sayfası hero görseli:** `luggage-storage/[slug]` sayfası Unsplash hotlink kullanıyor (`page.tsx`) — yerel optimize görsele (next/image) taşı; LCP + telif + dış bağımlılık.
- [ ] **Blog içerik:** Yayında 0 yazı varsa ilk 2 yazıyı lansmanla birlikte çıkar (takvim: marketing planı §2).
- [ ] **Partner GBP:** İlk noktalar için Google Business Profile kayıtları.
- [ ] **KVKK metinleri son okuma:** `/kvkk`, `/privacy`, `/terms` gerçek şirket bilgileriyle güncel mi (unvan, adres, veri sorumlusu).
- [ ] **`npm audit`** + bağımlılık taraması.

## Canlı site denetimi bulguları (2026-06-10, bagajpark.com)

Site Cloudflare arkasında ayakta; TR/EN ana sayfa, arama, şehir, login, FAQ sayfaları iPhone viewport'ta temiz render oluyor (yatay taşma yok, 4xx/5xx yok). Tespit edilen sorunlar:

- 🔴 **Canlı robots.txt `Sitemap: http://localhost:3000/sitemap.xml` gösteriyor** — robots build sırasında statik üretildiği için build env'inde base URL yokmuş. Kodda düzeltildi (`force-dynamic`); **yeni deploy gerekiyor**. Sitemap'in kendisi doğru (406 URL, hepsi https://bagajpark.com).
- 🟠 **`/tr/search` haritası CSP'ye takılıyor:** MapLibre blob worker'ı engelleniyordu. CSP'ye `worker-src 'self' blob:` eklendi.
- 🟠 **Crisp chat CSP'de yoktu:** `client.crisp.chat` script/style/font-src'ye eklendi.
- ℹ️ Search Console zaten aktif; deploy sonrası sitemap'i yeniden gönder + "URL Inspection" ile /tr'yi test et.

## Bu denetimde yapılan kod düzeltmeleri (2026-06-10)

- `robots.ts`: `/account` ve `/auth` rotaları disallow'a eklendi; localhost hatasına karşı `force-dynamic` yapıldı.
- `sitemap.ts`: noindex olan `/checkout/{shopId}` URL'leri sitemap'ten çıkarıldı (robots disallow ile çelişiyordu); tüm girdilere hreflang `alternates.languages` (14 dil + x-default) eklendi.
- `next.config.ts` CSP: `worker-src 'self' blob:` (MapLibre) ve `client.crisp.chat` (Crisp) eklendi.
- `[locale]/layout.tsx`: `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` ile Search Console meta doğrulama desteği.
- `docker-compose.env.example`: SEO/analitik env bölümü (`NEXT_PUBLIC_BASE_URL`, GSC, Plausible).
