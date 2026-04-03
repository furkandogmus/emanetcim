# emanetcim

Next.js tabanlı Emanetçi uygulaması (PostgreSQL, Prisma, Auth.js, iyzico).

| | |
|--|--|
| Geliştirme | `npm install` → `npm run dev` |
| Test | `npm run test` |
| Lint | `npm run lint` (`eslint`) |
| Docker | `npm run docker:up` veya `docker compose up --build -d` — **http://localhost** (Nginx, 80). Ayrıntı: [`docs/DOCKER.md`](docs/DOCKER.md) |
| Ortam şablonu | [`.env.example`](.env.example) |

CI: `main` dalına push / PR’da **test** ve **build** (GitHub Actions). ESLint uyarıları azalınca workflow’a `npm run lint` eklenebilir.

**Dallar:** günlük işler için `develop` + `feature/...`; ayrıntı [`docs/BRANCHING.md`](docs/BRANCHING.md). Yerel `npm run dev` hangi dalda olursanız olun aynı hızda çalışır.
