# Playwright E2E

Bu testler **PostgreSQL** üzerinde seed edilmiş veri bekler (ör. Galata dükkanı, demo kullanıcılar).

Dosyalar: `use-cases.spec.ts` (senaryolar `UC:` ile gruplu), `booking-lifecycle.spec.ts` (uçtan uca yaşam döngüsü), `core.spec.ts`, `admin-platform-settings.spec.ts`, `seo-and-consent.spec.ts`, `production-hardening.spec.ts` (proxy, PWA).

**CI:** `.github/workflows/ci.yml` → `e2e` job'ı (`Dogrula / build + E2E`: Postgres + seed + slot üretimi + Chromium); sonucu zorunlu `Dogrula (lint, tip, test, e2e)` kontrolüne girer. Yerelde `npm run test:e2e`.

**Durum (2026-08-23):** suite manuel tahsilat akışına göre yeniden yazıldı; `booking-lifecycle.spec.ts`
misafir → rezervasyon → iptal ve esnaf → teslim al → teslim et akışlarını uçtan uca kapsar.

**Giriş limiti:** `login:<e-posta>` anahtarı saatte 10 deneme. Yerelde Playwright dev
sunucuyu `E2E_DISABLE_RATE_LIMIT=true` ile kaldırır ve limit kapanır; bayrak production
modunda (`next start`, CI) okunmaz. Var olan bir sunucu yeniden kullanılıyorsa
(`reuseExistingServer`) bayrak ona ulaşmaz: demo girişleri `tooManyRequests` ile düşerse
sunucuyu yeniden başlatın ya da Redis'i `FLUSHALL` edin.

## Yerelde çalıştırma

1. Veritabanını ayağa kaldırın ve şemayı uygulayın:
   - `npm run db:up` (yalnızca Postgres; ya da mevcut Postgres’iniz — `docs/DOCKER.md`)
   - `npx prisma migrate deploy`
   - `npx prisma db seed`
2. `DATABASE_URL`'i açıkça verin (`.env.local` ya da ortam). `playwright.config.ts`'teki yedek
   değer eski `emanetci:emanetci@…/emanetci` bilgilerini taşıyor ve bugünkü compose varsayılanıyla uyuşmaz.
   - Uygulama **host’ta** (`npm run dev`), Postgres **Docker’da** ise `docker-compose` portu **5433**’tür; örnek:
     `postgresql://bagajpark:<POSTGRES_PASSWORD>@localhost:5433/bagajpark?schema=public`
     (kullanıcı/DB varsayılanı `bagajpark`, parola `docker-compose.env`'deki değer — `docs/DOCKER.md`)
   - Sadece `docker compose up` ile `web` konteyneri kullanıyorsanız Compose içi `postgres:5432` kullanılır (host portu gerekmez).
3. Demo giriş şifresi seed ile aynı olmalı: `NEXT_PUBLIC_DEMO_PASSWORD` (yoksa `Demo123!`; seed ve giriş sayfası aynı değişkeni okur). Demo düğmeleri yalnızca `NEXT_PUBLIC_ENABLE_AUTH_DEMO=true` ile derlenen build'de görünür.
4. `npm run test:e2e` (`playwright.config.ts` dev sunucuyu kendisi kaldırır)

Belirli senaryoları çalıştırmak için: `npx playwright test tests/e2e/use-cases.spec.ts -g "UC:"`

Veritabanı yokken arama sayfası boş kalır; `shop-list-item` bulunamadığı için checkout senaryoları zaman aşımına düşer.
