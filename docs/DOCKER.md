# Docker Compose (Postgres + Next.js + Nginx)

Vercel/serverless kullanmadan tek makinede veya sunucuda çalıştırmak için **PostgreSQL 16**, **Next.js (standalone)** ve önde **Nginx** (reverse proxy + `public/` statikleri) birlikte ayağa kalkar.

**LAN’daki Ubuntu VM + `emanetci.local`:** [VM-LAN.md](./VM-LAN.md).

**Yedek / geri yükleme (Postgres):** [BACKUP.md](./BACKUP.md).

## Gereksinimler

- Docker + Docker Compose v2
- İlk çalıştırmada imaj derlenir (`docker compose build`)
- **80** numaralı port boş olmalı (Nginx). Doluysa `docker-compose.yml` içinde `nginx` → `ports` satırını örneğin `"8080:80"` yapın.

## Hızlı başlangıç

```bash
docker compose up --build -d
```

- Uygulama (Nginx üzerinden): **http://localhost** (port **80**)
- Next.js konteyneri dışarıya kapalıdır; yalnızca Docker ağında `web:3000` olarak dinler.
- Postgres (host makineden): **localhost:5433** → konteyner içi `postgres:5432` (host’ta **5432** çoğu zaman dolu olduğu için **5433** kullanılır)

### Nginx ne yapıyor?

| Yol | Davranış |
|-----|----------|
| `/_next/static/` | Next.js’e proxy; `Cache-Control: public, max-age=31536000, immutable` |
| `public/` altında dosya (ör. `/manifest.json`, `/icons/…`, `*.svg`) | Doğrudan diskten (volume) |
| Diğer tüm istekler | Next.js’e proxy (sayfalar, API, RSC) |

Yapılandırma: `nginx/conf.d/default.conf`.

**Auth.js** Nginx arkasında doğru çalışsın diye `web` servisinde **`AUTH_TRUST_HOST=true`** (varsayılan) verilir; kapatmak için `AUTH_TRUST_HOST=false` kullanın.

Next.js’e doğrudan **3000** portundan erişmek için: `docker-compose.override.example.yml` dosyasını `docker-compose.override.yml` olarak kopyalayın (`.gitignore`’da); sonra `docker compose up -d`.

Sağlık kontrolleri (Nginx üzerinden):

- `GET http://localhost/api/health/live` — süreç ayakta (DB yok)
- `GET http://localhost/api/health` — Postgres `SELECT 1`

## Ortam değişkenleri

`docker-compose.yml` içinde **`AUTH_URL` / `NEXT_PUBLIC_APP_URL` varsayılan olarak boştur**; Auth.js isteğin `Host` ve `X-Forwarded-*` başlıklarından URL üretir (ngrok ve tek makinede localhost uyumu). Tek sabit domain (ör. `emanetci.local`) için `docker-compose.env` içinde bu iki değişkeni doldurun — aksi halde OAuth yine tünel adresine döner. Üretim benzeri deneme için:

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
