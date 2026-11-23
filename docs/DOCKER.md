# Docker Compose — yerel çalıştırma

`docker-compose.yml` **üretim** dosyasıdır: canlı sunucu (`/opt/emanetci`, AWS EC2) aynı
dosyayla koşar ve CI her deploy'da onu sunucuya gönderir. Bu sayfa aynı dosyanın yerelde
nasıl kullanılacağını anlatır. Sunucu işletimi (erişim, deploy, yedek): [`ops/README.md`](../ops/README.md);
altyapı: [`infra/aws/README.md`](../infra/aws/README.md).

(2026-11-23: eski `docs/VM-LAN.md` — LAN'daki Ubuntu VM + `emanetci.local` akışı — buraya
katıldı ve kaldırıldı; o kurulum Hetzner dönemine aitti.)

## Servisler

| Servis | İmaj | Not |
|---|---|---|
| `postgres` | `postgis/postgis:16-3.4-alpine` | Host'ta yalnızca `127.0.0.1:5433` (konteyner içi `postgres:5432`) |
| `redis` | `redis:7-alpine` | Rate limit sayaçları; kalıcılık kapalı |
| `web` | `ghcr.io/furkandogmus/emanetcim:latest` (`build: .` ile yerelde derlenebilir) | Next.js standalone, `web:3000`; başlarken `prisma migrate deploy` koşar (`scripts/docker-entrypoint.sh`) |
| `nginx` | `nginx:1.27-alpine` | 80/443; **yalnızca üretim için** yapılandırılmış (aşağıya bakın) |

## En kısa yol: yalnızca Postgres Docker'da

Günlük geliştirmede uygulama host'ta koşar, Docker yalnızca veritabanını verir:

```bash
cp docker-compose.env.example docker-compose.env   # POSTGRES_PASSWORD vb. doldurun
docker compose --env-file docker-compose.env up -d postgres   # ya da: npm run db:up
# .env.local içinde:
# DATABASE_URL=postgresql://bagajpark:<parola>@127.0.0.1:5433/bagajpark?schema=public
npx prisma migrate deploy && npx prisma db seed
npm run dev
```

`POSTGRES_PASSWORD` **zorunludur** — compose onsuz başlamaz (üretimde değer SSM'den gelir,
`ops/SECRETS.md`). Kullanıcı ve veritabanı adı varsayılanı `bagajpark`.

## Tam yığın (web konteyneri dahil)

```bash
cp docker-compose.override.example.yml docker-compose.override.yml   # web:3000'i host'a açar
docker compose --env-file docker-compose.env up -d postgres redis web
curl -s http://localhost:3000/api/health/live
```

`docker compose build web` imajı yerelde derler; derlemezseniz GHCR'daki `latest` çekilir.

**nginx yerelde kullanılmaz.** `nginx/conf.d/default.conf` üretim konfigidir: 80'i
`https://bagajpark.com`'a yönlendirir, 443 için `/etc/ssl/cloudflare/bagajpark.{crt,key}`
bekler. Bu sertifikalar yalnızca sunucuda vardır; yerelde nginx açılmaz. Konfigi
değiştirdiyseniz sınamak için: `bash scripts/verify-nginx-conf.sh` (`scripts/README.md`).

## Auth adresleri (tünel / sabit alan adı)

`AUTH_URL` ve `NEXT_PUBLIC_APP_URL` compose'da varsayılan olarak boştur; Auth.js adresi
isteğin `Host` / `X-Forwarded-*` başlıklarından üretir (`AUTH_TRUST_HOST=true`).

- **Sabit bir alan adı** (ör. yerel ağdaki bir makine) kullanılacaksa iki değişkeni
  `docker-compose.env` içinde o adrese ayarlayın.
- **ngrok gibi bir tünel** kullanılacaksa ikisini **boş bırakın**; dolu `AUTH_URL`, OAuth
  dönüşünü tünel yerine o adrese yönlendirir. Google OAuth istemcisine
  `https://<tünel-adresi>/api/auth/callback/google` dönüş adresini ekleyin.

## Sağlık uçları

- `GET /api/health/live` — süreç ayakta (DB'ye dokunmaz)
- `GET /api/health` — Postgres + Redis
- `GET /api/health/jobs` — zamanlanmış işler (`docs/OBSERVABILITY.md`)

## Sık sorunlar

- **P1000 (authentication failed):** volume farklı kullanıcı/parolayla oluşturulmuş.
  Yerel veriyi silmek kabul edilebilirse `docker compose down -v` ve yeniden `up`.
- **Seed:** konteynerde `tsx` yok; seed host'tan, `127.0.0.1:5433`'e bağlanarak koşar.
  Seed'i asla prod'a karşı çalıştırmayın (`seed-guard`).

## Mimari notlar

- `next.config.ts` → `output: "standalone"` üretim imajı için gerekli.
- İmaj Prisma CLI'ı taşır; migrasyon konteyner başlarken uygulanır ve başarısızsa
  konteyner açılmaz (`scripts/docker-entrypoint.sh`).
