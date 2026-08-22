# BagajPark (Emanetçi)


| | |
|--|--|
| Geliştirme | `npm install` → `npm run dev` |
| Test | `npm run test` |
| Lint | `npm run lint` (`eslint`) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) |
| Docker | `npm run docker:up` veya `docker compose up --build -d` — **http://localhost** (Nginx, 80). Ayrıntı: [`docs/DOCKER.md`](docs/DOCKER.md) |
| Ortam şablonu | [`.env.example`](.env.example) |

İş kuralları (max konaklama günü, sigorta, valiz çarpanları, iptal kesintisi vb.) `PlatformSettings` tablosunda tutulur; `prisma migrate` + `prisma db seed` ile `default` satırı oluşur. Admin’den yönetim: [`docs/PLATFORM_SETTINGS.md`](docs/PLATFORM_SETTINGS.md).

**Operasyon:** [Ödeme mimarisi](docs/PAYMENTS.md) · [Finans / ledger](docs/FINANCE_LEDGER.md) · [Gözlemlenebilirlik](docs/OBSERVABILITY.md)

**Yol haritası / commit disiplini:** [Üretim backlog](docs/PRODUCTION_BACKLOG.md) · [Commit mesajları ve geçmiş](docs/GIT_COMMIT_GUIDE.md)

CI: `main` / `develop` push ve PR’da **migrate deploy**, **lint**, **typecheck**, **test** (Postgres ile integration dahil) ve **build** (GitHub Actions). Bağımlılık taraması için yerelde `npm audit` kullanın.

**Dallar:** günlük işler için `develop` + `feature/...`; ayrıntı [`docs/BRANCHING.md`](docs/BRANCHING.md). Yerel `npm run dev` hangi dalda olursanız olun aynı hızda çalışır.

**Sürüm:** `npm run release:patch` → `git push --follow-tags` → GitHub’da otomatik Release. [`docs/VERSIONING.md`](docs/VERSIONING.md).

**AI / prompt ile geliştirme:** standartlar ve PR checklist için [`docs/PROMPT_GOVERNANCE.md`](docs/PROMPT_GOVERNANCE.md).
