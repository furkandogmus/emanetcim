# Geliştirme: yerel ortam, değişiklik süreci, CI/CD

Mimari kurallar ve mandal testleri kök `CLAUDE.md`'de, mobil `mobile-expo/CLAUDE.md`'de.
Sunucu işletimi (deploy, sırlar, yedek) `ops/README.md`'de. Bu belge 2026-11-23'te eski
`DOCKER.md`, `GIT_COMMIT_GUIDE.md`, `PROMPT_GOVERNANCE.md` ve `CI_CD.md`'nin yerine geçti.

## 1. Yerel ortam

`docker-compose.yml` **üretim** dosyasıdır: sunucu (`/opt/emanetci`, AWS EC2) aynı dosyayla
koşar. Yerelde iki tarif var.

| Servis | İmaj | Not |
|---|---|---|
| `postgres` | `postgis/postgis:16-3.4-alpine` | Host'ta `127.0.0.1:5433` (konteyner içi `postgres:5432`) |
| `redis` | `redis:7-alpine` | Rate limit sayaçları; kalıcılık kapalı |
| `web` | `ghcr.io/furkandogmus/emanetcim:latest` (`build: .` ile yerelde derlenir) | Başlarken `prisma migrate deploy` koşar, başarısızsa açılmaz (`scripts/docker-entrypoint.sh`) |
| `nginx` | `nginx:1.27-alpine` | **Yalnızca üretim**: 80'i `https://bagajpark.com`'a yönlendirir, 443 için sunucudaki Cloudflare sertifikasını ister. Yerelde açılmaz |

**Günlük yol: yalnızca Postgres Docker'da**

```bash
cp docker-compose.env.example docker-compose.env   # POSTGRES_PASSWORD zorunlu
npm run db:up                                       # docker compose up -d postgres
# .env.local: DATABASE_URL=postgresql://bagajpark:<parola>@127.0.0.1:5433/bagajpark?schema=public
npx prisma migrate deploy && npx prisma db seed
npm run dev
```

**Tam yığın:** `cp docker-compose.override.example.yml docker-compose.override.yml` (web:3000'i
host'a açar), sonra `docker compose --env-file docker-compose.env up -d postgres redis web`.

- **Auth adresleri:** `AUTH_URL` ve `NEXT_PUBLIC_APP_URL` boşsa Auth.js adresi `Host` /
  `X-Forwarded-*`'tan üretir. Sabit alan adında ikisini ona ayarla; ngrok gibi bir tünelde
  **boş bırak** (dolu `AUTH_URL` OAuth dönüşünü tünel yerine oraya yollar) ve Google
  istemcisine `https://<tünel>/api/auth/callback/google` ekle. OAuth kurulumu:
  `docs/GUVENLIK_VE_IZLEME.md` § Kimlik doğrulama.
- **Sağlık uçları:** `/api/health/live` (süreç), `/api/health` (Postgres + Redis),
  `/api/health/jobs` (zamanlanmış işler).
- **P1000 (authentication failed):** volume başka parolayla oluşturulmuş; veri silinebilirse
  `docker compose down -v`.
- **Seed** host'tan `127.0.0.1:5433`'e koşar (konteynerde `tsx` yok). Prod'a karşı asla
  (`seed-guard`).
- nginx konfigini değiştirdiysen: `bash scripts/verify-nginx-conf.sh`.
- E2E ayrıntısı `tests/e2e/README.md`, yük testi `tests/stress/README.md`.

## 2. Değişiklik süreci

`main` **yalnızca PR ile** değişir (ruleset `main-korumasi`, 2026-09-23); her merge prod'a
deploy eder.

1. `main`'den tek konulu dal: `feat/…`, `fix/…`, `docs/…`, `ci/…`, `chore/…`. `develop`
   2026-08-22'den beri kullanılmıyor.
2. Dalda küçük commit'ler; her biri tek mantıksal değişiklik, kendi başına derlenir.
3. **Başlık:** Conventional Commits, ASCII, ≤ 100 karakter, kapsam `[a-z0-9._/-]`
   (`.github/workflows/pr-gate.yml` denetler). Tipler: `feat`, `fix`, `docs`, `test`,
   `chore`, `ci`, `refactor`, `perf`, `build`, `revert`, `style`. Gövdede **neden**: hangi
   prod verisi, hangi hata.
4. PR şablonunu doldur. Zorunlu kontroller: `Dogrula (lint, tip, test, e2e)` ve
   `PR kurallari`.
5. Birleştirme yalnızca **rebase merge** (doğrusal geçmiş). Dal birleşince silinir.
6. Merge = deploy: `CI` workflow'unun `Deploy` job'ını izle (`gh run watch`).
7. Acil durumda admin kırmızı PR'ı bile birleştirebilir (bypass, yine PR üzerinden);
   nedenini PR'a yaz. Ayrı `hotfix/` akışı yok.

**Migrasyon:** şemayı daraltan değişiklik kodla aynı PR'a girmez. Önce geriye uyumlu genişlet,
eski yapıyı sonraki PR'da kaldır: deploy sırasında eski imaj yeni şemayla birkaç dakika çalışır.

**Bitti tanımı (her PR):** `npm run typecheck && npm run lint && npm test`; mobil
dokunulduysa `cd mobile-expo && npm run verify`; mandal tavanı yükselmedi; migrasyon varsa
`npm run db:verify`; ödeme yazımı yalnız `PaymentService` üzerinden; davranış değiştiyse
ilgili belge aynı PR'da.

**Sürüm etiketi:** `npm run release:patch|minor|major` commit + `v*.*.*` etiketi üretir;
etiket push'u `release.yml` ile GitHub Release açar. Web pratikte etiketlenmiyor
(`package.json` 0.1.0, son etiket v0.0.2, 2026-06-11); ruleset altında etiketleme de PR
ister. Mobil sürüm ayrı: `mobile-expo/app.json`.

## 3. CI/CD

Tek giriş noktası `.github/workflows/ci.yml`:

```
push/PR → main
   changes ─┬─ checks  lint → typecheck → nginx -t → audit → migrate → db:verify → testler
            ├─ e2e     build → migrate → seed → Playwright        (paralel)
            └─ verify  "Dogrula (lint, tip, test, e2e)" — zorunlu toplayıcı
   image    (yalnız main push) verify ile paralel; yalnız sha-<sha> etiketi
   deploy   needs: verify, checks, e2e, image → latest'i doğrulanmış digest'e taşır → S3 + SSM
```

`mobile-expo-ci.yml` (`Expo dogrulama (tip, lint, test)`) yol filtreli, zorunlu değil;
`release.yml` yalnız sürüm etiketinde.

Neden böyle (her biri bir olaydan):

- **Kırmızı commit üretime çıkamaz.** Eskiden deploy ayrı workflow'du ve CI'ı beklemiyordu.
  Artık `deploy` doğrulamanın her parçasına `needs` ile bağlı; imaj paralel derlenir ama
  `latest`e (sunucunun çektiği etiket) yalnızca her şey geçince taşınır.
- **Zorunlu kontrolün adı sabit.** Ruleset adı bekler; `verify` `if: always()` ile her koşuda
  rapor verir. Adı değiştirmek PR'ları sonsuza dek bekletir.
- **PR'da yol filtresi yok.** Tetiklenmeyen zorunlu kontrol PR'ı "bekliyor"da bırakır;
  uygulamaya dokunmayan PR'da `checks`/`e2e` koşulla atlanır, `verify` yeşil döner. Push'ta
  `paths-ignore`: `docs/**`, `ops/**`, `**/*.md`.
- **Docker imajı kendi build'ini yapar.** E2E build'i `NEXT_PUBLIC_ENABLE_AUTH_DEMO=true` ile
  derlenir ve bayrak gömülür; o çıktı canlıya demo giriş düğmesi taşırdı.
- **Sunucuya giden her şey S3 üzerinden:** `docker-compose.yml`, `public/`, `scripts/`,
  `nginx/conf.d/`, `ops/secrets.manifest`. Listede olmayan dosya sunucuya hiç ulaşmaz
  (`scripts/` eksikken sekiz cron işi birden düşmüştü).
- **nginx iki kapıdan geçer:** `checks`'te üretim imajıyla gerçek `nginx -t`, sunucuda
  `up -d`'den sonra yine `nginx -t`; geçmezse deploy kırmızı düşer.
- **İptal job seviyesinde, deploy asla iptal edilmez** ve `deploy-production` grubunda sırayla
  koşar: yarıda kesilen deploy sunucuyu yarı güncellenmiş bırakır.
- Her job'da `timeout-minutes`; `node_modules` lockfile + Node sürümü hash'iyle önbellekte.

**Actions kotası:** repo 2026-11-23'ten beri public, standart koşucular ücretsiz. Private
dönemde (2.000 dk/ay) kota dolunca job'lar **0 adımda, ~3 saniyede** düşüyor ve hiç log
bırakmıyordu; kodda aranacak bir şey yok. Teyit:

```bash
gh api repos/<owner>/<repo>/actions/runs/<id>/jobs \
  --jq '.jobs[] | "\(.name) | adim: \(.steps | length)"'
```

macOS koşucusu 10× faturalanır; Expo derlemeleri bu yüzden EAS'te.
