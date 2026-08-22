# BagajPark (Emanetçi) — çalışma kuralları

Valiz emanet pazar yeri: misafir → dükkan (esnaf) → plastik mühür → teslim. Web Next.js,
mobil Flutter (`mobile/`), tek Hetzner VM'de Docker Compose. Ürün haritası: `README_AI.md`.

## Komutlar

```bash
npm run typecheck && npm run lint && npm test   # her değişiklikten sonra, üçü birden
npm run build        # DATABASE_URL/AUTH_SECRET/NEXT_PUBLIC_BASE_URL yer tutucuyla çalışır
npm run db:verify    # migrasyon ↔ schema.prisma sapması (gerçek Postgres ister)
npm run test:e2e     # Playwright; dev sunucuyu kendisi kaldırır
```

## Dil

- Tanımlayıcılar İngilizce; yorumlar, commit mesajları, dokümanlar Türkçe.
- Commit: Conventional Commits, başlık ASCII (`fix(seal): muhur ...`). Gövdede **neden**
  — hangi prod verisi / hangi hata buna yol açtı. `docs/GIT_COMMIT_GUIDE.md`.
- Kullanıcıya görünen her metin `src/locales/<dil>.json`'a girer; bileşende
  `locale === "tr" ? ... : ...` yazılmaz (mandal testi var).

## Mimari kurallar

- **Yazma işlemleri yalnızca `src/services/`** üzerinden. Rezervasyon yaşam döngüsü
  `src/services/booking/` (create, check-in, check-out, lifecycle); `BookingService` cephedir. `app/` ve `actions/`
  Prisma'yı okuma için doğrudan kullanabilir.
- **Para yalnızca `PaymentService`** ile değişir; `PaymentLog` elle yazılmaz.
  Sağlayıcı port/adapter: `src/lib/payments/`. Tutarlar `Decimal`; istemciye
  `moneyToNumber` ile çıkar.
- **Zamanlanmış işler `src/lib/jobs/registry.ts`**'e kaydedilir; crontab ve sağlık
  kontrolü oradan türer.
- **Modal** çizen her bileşen `useModalBehavior` + `role="dialog"` taşır
  (`modal-a11y.test.ts`). Yıkıcı onay için `ConfirmDialog`.
- **Mühür** yazımı `SealService.applyCheckInWithinTx`; gövde doğrulaması
  `src/lib/seal-payload.ts` (web + mobil aynı şema).
- Web auth: Auth.js v5 (`src/auth.config.ts`, `src/proxy.ts`). Mobil auth: jose JWT
  (`src/lib/mobile-auth.ts`). İkisi ayrı, karıştırılmaz.
- `src/repositories/` YOK — servisler Prisma'yı doğrudan kullanır.

## Mandal (ratchet) testleri — sayı düşebilir, yükselemez

| Test | Ne ölçer |
|---|---|
| `src/locales/locales.test.ts` | eksik çeviri anahtarı |
| `src/__tests__/hardcoded-copy.test.ts` | bileşen içi sabit iki dilli metin |
| `src/__tests__/input-labels.test.ts` | etiketsiz form girdisi |
| `src/__tests__/modal-a11y.test.ts` | dialog rolü / Escape olmayan modal |
| `src/__tests__/jobs-registry.test.ts` | kayıt defteri ↔ `/api/internal` uçları |

Tavan sayısını yükselten bir PR, sorunu çözmüyor, saklıyor.

## Nerede ne var

- Kanıtlı hata kuyruğu: `docs/DEFECT_BACKLOG.md` (tek iş listesi; `PRODUCTION_BACKLOG`
  stratejik dilek listesidir).
- Ödeme mimarisi `docs/PAYMENTS.md`, iş kuralları `docs/PLATFORM_SETTINGS.md`,
  cron/sağlık `scripts/README.md`, deploy `docs/DOCKER.md` + `ops/README.md`.
- Prod: Hetzner, `main` push → GHCR → deploy (`.github/workflows/deploy.yml`).
  AWS (`infra/aws`) paralel deneme ortamıdır, prod değil.

## Yapma

- `typescript.ignoreBuildErrors`, `unknown`→`any` regex düzeltmeleri, `as any`.
- Seed'i prod'a karşı çalıştırma (`seed-guard`).
- Git'e ekran görüntüsü, log dökümü, çerez dosyası (`.gitignore` kökte `*.png`/`*.txt` engeller).
