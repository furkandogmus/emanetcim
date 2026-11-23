# BagajPark (Emanetçi)

Valiz emanet pazar yeri: misafir → dükkan (esnaf) → plastik mühür → teslim. Web Next.js,
mobil Expo (`mobile-expo/`), üretim tek AWS EC2 VM'de Docker Compose.

| | |
|--|--|
| Geliştirme | `npm install` → `npm run db:up` (yalnızca Postgres, Docker) → `npm run dev` |
| Kapı | `npm run typecheck && npm run lint && npm test` (mobil: `cd mobile-expo && npm run verify`) |
| E2E | `npm run test:e2e` (Playwright) |
| Docker | Yerel tarifler: [`docs/DOCKER.md`](docs/DOCKER.md). `docker-compose.yml` üretim dosyasıdır; nginx yalnızca sunucuda çalışır |
| Ortam şablonu | [`docker-compose.env.example`](docker-compose.env.example) (Docker) · [`.env.ci.example`](.env.ci.example) (CI) |

**Çalışma kuralları:** [`CLAUDE.md`](CLAUDE.md) (mimari, mandal testleri, commit) ·
mobil [`mobile-expo/CLAUDE.md`](mobile-expo/CLAUDE.md) · ürün ve kod haritası [`README_AI.md`](README_AI.md).

**Ürün:** [Ürün ve iş kuralları](docs/URUN_VE_IS_KURALLARI.md) · [Platform ayarları](docs/PLATFORM_SETTINGS.md) · [Ödeme](docs/PAYMENTS.md) · [OAuth](docs/OAUTH.md)

**Operasyon:** [Sunucu işletimi](ops/README.md) · [Sırlar (SSM)](ops/SECRETS.md) · [Altyapı](infra/aws/README.md) · [Zamanlanmış işler](scripts/README.md) · [Gözlemlenebilirlik](docs/OBSERVABILITY.md) · [CI/CD](docs/CI_CD.md)

**İş listeleri:** [Kanıtlı hata kuyruğu](docs/DEFECT_BACKLOG.md) · [Üretim backlog ve yol haritası](docs/PRODUCTION_BACKLOG.md) · [Yayın kontrol listesi](docs/LAUNCH_CHECKLIST.md)

**Değişiklik süreci:** `main`'e doğrudan push yok; her iş kendi dalında, PR ile gelir ve
rebase merge ile birleşir. Merge = prod deploy (doğrulama ∥ GHCR imajı → `latest` + SSM).
Ayrıntı: [`docs/GIT_COMMIT_GUIDE.md`](docs/GIT_COMMIT_GUIDE.md), [`docs/CI_CD.md`](docs/CI_CD.md).

**Mobil yayın:** Android [`mobile-expo/PLAY_YAYIN.md`](mobile-expo/PLAY_YAYIN.md) · iOS [`mobile-expo/IOS_YAYIN.md`](mobile-expo/IOS_YAYIN.md).
