# Playwright E2E

Bu testler **PostgreSQL** üzerinde seed edilmiş veri bekler (ör. Galata dükkanı, demo kullanıcılar).

Dosyalar: `use-cases.spec.ts` (senaryolar `UC:` ile gruplu), `payment-iyzico-sandbox.spec.ts` (iyzico panel anahtarlarıyla başarılı/başarısız kartlar), `core.spec.ts`, `street-readiness.spec.ts`, `production-hardening.spec.ts` (middleware, PWA).

**CI:** E2E şu an workflow’ta çalışmıyor; tamamı **yerelde** `npm run test:e2e` veya `npm run test:e2e:local` ile koşulur.

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

### iyzico sandbox — başarılı / başarısız kart testleri

`src/services/PaymentService.ts` geliştirme modunda `IYZICO_API_KEY` yokken veya `sandbox-api-key` iken ödemeyi **simüle** eder; bu durumda **başarısız** test kartları da “başarılı” sayılır.

Gerçek sandbox API ile tüm kart senaryolarını denemek için `.env.local` içinde iyzico panelden alınmış **sandbox** `IYZICO_API_KEY` ve `IYZICO_SECRET_KEY` tanımlayın (placeholder `sandbox-api-key` / `sandbox-secret-key` olmasın). İsteğe bağlı: `IYZICO_BASE_URL=https://sandbox-api.iyzipay.com`.

Sonra: `npm run test:e2e:sandbox`

Kart listesi ve hata üreten numaralar: [iyzico Test Cards](https://docs.iyzico.com/en/add-ons/test-cards)

Veritabanı yokken arama sayfası boş kalır; `shop-list-item` bulunamadığı için checkout senaryoları zaman aşımına düşer.
