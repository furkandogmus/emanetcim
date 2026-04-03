# Docker Compose (Postgres + Next.js)

Vercel/serverless kullanmadan tek makinede veya sunucuda çalıştırmak için **PostgreSQL 16** ve **Next.js (standalone)** birlikte ayağa kalkar.

## Gereksinimler

- Docker + Docker Compose v2
- İlk çalıştırmada imaj derlenir (`docker compose build`)

## Hızlı başlangıç

```bash
docker compose up --build -d
```

- Uygulama: **http://localhost:3000**
- Postgres (host makineden): **localhost:5433** → konteyner içi `postgres:5432` (host’ta **5432** çoğu zaman dolu olduğu için **5433** kullanılır)

Sağlık kontrolleri:

- `GET http://localhost:3000/api/health/live` — süreç ayakta (DB yok)
- `GET http://localhost:3000/api/health` — Postgres `SELECT 1`

## Ortam değişkenleri

`docker-compose.yml` içinde varsayılanlar tanımlıdır. Üretim benzeri deneme için:

```bash
export AUTH_SECRET="$(openssl rand -base64 32)"
docker compose up -d --build
```

İsteğe bağlı: `docker-compose.env.example` dosyasını kopyalayıp düzenleyin:

```bash
cp docker-compose.env.example docker-compose.env
# düzenle
docker compose --env-file docker-compose.env up -d --build
```

iyzico, e-posta vb. için anahtarları compose ortamına veya `environment:` ile `web` servisine ekleyin (`.env.example` ile uyumlu isimler).

## Veritabanı şeması

Projede migration klasörü yoksa konteyner her başlangıçta **`prisma db push`** ile şemayı senkronize eder. İleride `prisma migrate` kullanırsanız `prisma/migrations` dolu olduğunda entrypoint **`prisma migrate deploy`** çalıştırır (`scripts/docker-entrypoint.sh`).

Eski volume farklı kullanıcı/şifreyle oluşturulduysa **P1000 (authentication failed)** görürsünüz; veriyi silmek kabul edilebilirse:

```bash
docker compose down -v
docker compose up -d --build
```

## Seed (isteğe bağlı)

Konteyner içinde `tsx` yoktur. Seed’i geliştirme makinesinden, host’taki Postgres’e bağlanarak çalıştırın:

```bash
DATABASE_URL="postgresql://emanetci:emanetci@127.0.0.1:5433/emanetci?schema=public" npx tsx prisma/seed.ts
```

## Mimari notlar

- `next.config.ts` içinde **`output: "standalone"`** — üretim imajı için gerekli.
- `dotenv` **dependencies** içinde; `prisma.config.ts` hem yerelde hem konteynerde yüklenir.
- Konteynerde `NODE_PATH=/usr/local/lib/node_modules` ile global **Prisma CLI**, `prisma db push` / `migrate deploy` sırasında `prisma/config` modülünü bulur.
