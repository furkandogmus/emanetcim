# Playwright E2E

Bu testler **PostgreSQL** üzerinde seed edilmiş veri bekler (ör. Galata dükkanı, demo kullanıcılar).

Dosyalar: `use-cases.spec.ts` (senaryolar `UC:` ile gruplu), `workflow.spec.ts`, `core.spec.ts`, `street-readiness.spec.ts`, `production-hardening.spec.ts` (middleware, PWA).

**CI:** E2E şu an workflow’ta çalışmıyor; tamamı **yerelde** `npm run test:e2e` veya `npm run test:e2e:local` ile koşulur.

**Durum (2026-08-22):** 34 testin 29'u geçiyor, 1'i atlandı. Kalan 4 (`booking-lifecycle` ×2,
`street-readiness`, `workflow`) **kart ödeme dönemine** yazılmış — "Kart üzerindeki isim" alanı
bekliyor; aktif sağlayıcı `manual` (dükkanda tahsilat) ve checkout slot ızgarasına geçti. Bu
dördü yamayla değil, manuel tahsilat akışına göre yeniden yazılarak kurtarılır.

**Giriş limiti:** `login:<e-posta>` anahtarı saatte 10 deneme. Aynı dev sunucuda e2e'yi
birkaç kez üst üste koşunca demo girişleri `tooManyRequests` ile düşer; sunucuyu yeniden
başlatın (bellek içi sayaç sıfırlanır) ya da `REDIS_URL` ile Redis'i `FLUSHALL` edin.

## Yerelde çalıştırma

1. Veritabanını ayağa kaldırın ve şemayı uygulayın:
   - `docker compose up -d` (veya mevcut Postgres’iniz)
   - `npx prisma migrate deploy`
   - `npx prisma db seed`
2. `.env` içinde `DATABASE_URL` doğru olsun.
   - Uygulama **host’ta** (`npm run dev`), Postgres **Docker’da** ise `docker-compose` portu **5433**’tür; örnek:
     `postgresql://emanetci:emanetci@localhost:5433/emanetci?schema=public`
   - Sadece `docker compose up` ile `web` konteyneri kullanıyorsanız Compose içi `postgres:5432` kullanılır (host portu gerekmez).
3. Demo giriş şifresi seed ile aynı olmalı: `DEMO_PASSWORD` (varsayılan `Demo123!`). İstemci demo butonları `NEXT_PUBLIC_DEMO_PASSWORD` ile override edilebilir.
4. `npm run test:e2e` (veya aynı anlamda `npm run test:e2e:local`)

Belirli senaryoları çalıştırmak için: `npx playwright test tests/e2e/use-cases.spec.ts -g "UC:"`

Veritabanı yokken arama sayfası boş kalır; `shop-list-item` bulunamadığı için checkout senaryoları zaman aşımına düşer.
