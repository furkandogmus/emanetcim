# Playwright E2E

Bu testler **PostgreSQL** üzerinde seed edilmiş veri bekler (ör. Galata dükkanı, demo kullanıcılar).

## Yerelde çalıştırma

1. Veritabanını ayağa kaldırın ve şemayı uygulayın:
   - `docker compose up -d` (veya mevcut Postgres’iniz)
   - `npx prisma migrate deploy`
   - `npx prisma db seed`
2. `.env` içinde `DATABASE_URL` doğru olsun.
3. `npm run test:e2e`

Veritabanı yokken arama sayfası boş kalır; `shop-list-item` bulunamadığı için checkout senaryoları zaman aşımına düşer.

## CI önerisi

Workflow’ta `services: postgres` + migrate + seed adımlarından sonra `npm run test:e2e` çalıştırın.
