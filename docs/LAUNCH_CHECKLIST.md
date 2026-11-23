# Canlıya çıkış ve sürüm hazırlık listesi

Bu dosya iki şeyi tutar: (1) lansman sırasında kapatılan asgari maddelerin bugünkü
durumu, (2) büyük bir sürümden (ör. online ödemenin açılması, mobil mağaza yayını)
önce her seferinde yeniden yürünen kontrol listesi. Eski
`RELEASE_READINESS_CHECKLIST.md` 2026-11-23'te buraya katıldı. Geniş kapsamlı dilek
listesi `docs/PRODUCTION_BACKLOG.md`, kanıtlı hatalar `docs/DEFECT_BACKLOG.md`.

## Son durum — 2026-11-23

Site `bagajpark.com`'da yayında (AWS EC2, `infra/aws/`). Lansman ödemesiz yapıldı ve öyle
sürüyor: sağlayıcı `manual`, ödeme dükkanda (`docs/PAYMENTS.md`). Header'daki beta
rozeti `NEXT_PUBLIC_BETA_BADGE=true` ile açılır. Eski `PAYMENTS_ENABLED` env'i ve
`payments_enabled` bayrağı kodda yok; ödemeyi açan/kapatan tek anahtar `PAYMENT_PROVIDER`.

**Online ödemeyi açma kriterleri (2026-06-10 kararı, açık):**

- [ ] 50 aktif nokta
- [ ] 100 sorunsuz, uçtan uca tamamlanmış rezervasyon
- [ ] Esnaf onboarding'inde bilinen tıkanma kalmaması
- [ ] Şirket kuruluşu + PSP sözleşmesi, adaptör ve webhook ucu (`docs/PAYMENTS.md`)

Esnaf sözleşmesi: komisyon oranı yazılı, beta süresince komisyon alınmaz
(`platformCommissionRate` 0.20, etkin oran 0).

## A. Lansman bloklayanları (kapandı)

- [x] Domain + TLS, 80→443 (`nginx/`, sertifika `scripts/tls-put.sh`); `AUTH_PUBLIC_HOST`.
- [x] `NEXT_PUBLIC_BASE_URL=https://bagajpark.com` (boşken canonical/hreflang/sitemap localhost üretiyordu).
- [x] Üretim sırları SSM'de, env dosyası deploy'da üretilir (`ops/SECRETS.md`); Postgres parolası döndürüldü.
- [x] Google OAuth prod yönlendirmesi; Apple girişi web + iOS (`docs/OAUTH.md`).
- [x] E-posta (Resend) prod'da. SMS (Netgsm) bilerek kapalı.
- [x] `prisma migrate deploy` deploy'da; `PlatformSettings` default satırı var; seed prod'a karşı çalışmaz (`seed-guard`).
- [x] Yedek: 6 saatte bir S3'e (`scripts/backup-s3.sh`, `ops/crontab.prod`); geri yükleme `ops/README.md` § Yedek ve geri yükleme.

## B. SEO ve ölçüm

- [x] Search Console doğrulaması (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`) ve sitemap; `robots.ts` `force-dynamic` (localhost sitemap hatası 2026-06-10'da düzeltildi).
- [x] Plausible, çerez onayına bağlı (`src/components/ConsentAwareAnalytics.tsx`).
- [x] Dağıtık rate limit: `REDIS_URL` + `REQUIRE_DISTRIBUTED_RATE_LIMIT` (varsayılan açık).
- [ ] Bing Webmaster Tools (GSC'den içe aktarma).
- [ ] Dışarıdan sentetik izleme ve SSL süre uyarısı (`/api/health/live`).

## C. İlk haftalar

- [x] Güvenlik başlıkları `next.config.ts`'te: HSTS, `X-Frame-Options`, `Referrer-Policy`, COOP, CSP; ek olarak sıkı CSP `Report-Only` ve `/api/csp-report` (2026-11-23).
- [x] Bağımlılık taraması CI'da (`npm run audit`, `scripts/audit-deps.mjs`).
- [ ] Ana sayfa şehir kartlarında Unsplash hotlink görselleri (`src/app/[locale]/page.tsx`) yerel optimize görsele taşınmalı.
- [ ] Partner noktaları için Google Business Profile kayıtları.
- [ ] KVKK / gizlilik / şartlar metinlerinde şirket bilgileri, şirket kurulunca güncellenmeli.

## Sürüm öncesi kontrol listesi (her büyük sürümde)

**Akışlar** (Playwright `tests/e2e/` bir kısmını kapsar — `booking-lifecycle`, `use-cases`, `admin-platform-settings`; kalanı elle):

- Misafir kayıt, e-posta doğrulama, giriş (e-posta, Google, Apple)
- Arama → dükkan → rezervasyon → onay e-postası
- Esnaf check-in (QR, mühür), valiz revizyonu, check-out; geç bırakma ve "Misafiri bekle"
- Misafir rezervasyon detayı, iptal, itiraz, yorum
- Yönetici: başvuru onayı, iptal, itiraz çözümü, platform ayarı değişikliği

**Veri bütünlüğü:**

- Durum geçişleri `APPROVED → PAID → CHECKED_IN → CHECKED_OUT`, iptalde `CANCELLED`; her geçiş `BookingEvent`'te
- Çakışan pencerelerde kapasite aşılmıyor; iptalde slot ve kupon geri dönüyor
- Mühür seri numaraları check-in ↔ check-out tutarlı (`consistency-check` işi temiz)

**Altyapı:**

- `/api/health/live` 200; `web`, `nginx`, `postgres`, `redis` sağlıklı
- Zamanlanmış işler yeşil (`/admin/jobs`, `scripts/README.md`)
- CI kırmızıysa deploy olmaz (`docs/CI_CD.md`); geri dönüş önceki `sha-<sha>` imajıyla

**Mobil sürüm ek olarak:** `npm run verify` (mobile-expo), OTA çalışma zamanı uyumu ve
mağaza bayrakları (`docs/PLATFORM_SETTINGS.md` § Mağaza yayın bayrakları);
`mobile-expo/IOS_YAYIN.md`, `mobile-expo/PLAY_YAYIN.md`.
