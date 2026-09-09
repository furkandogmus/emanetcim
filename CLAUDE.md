# BagajPark (Emanetçi) — çalışma kuralları

Valiz emanet pazar yeri: misafir → dükkan (esnaf) → plastik mühür → teslim. Web Next.js,
mobil Flutter (`mobile/`), tek AWS EC2 VM'de Docker Compose. Ürün haritası: `README_AI.md`.

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
  `src/services/booking/` (create, check-in, check-out, lifecycle, partner-review,
  bag-revision); `BookingService` cephedir. `app/` ve `actions/` Prisma'yı okuma için
  doğrudan kullanabilir.
  - Kural `service-layer-writes` mandalıyla ölçülüyor: `Booking`, `ReservationSlot`,
    `BookingSeal`, `Seal`, `SealRequest`, `PaymentLog`, `Coupon` modellerine servis
    dışından yazmak **kesin yasak**; kalan modeller tavanla tutuluyor.
  - **Bir iş kuralını web action'ında ve mobil API ucunda ayrı ayrı yazma.** Gövde
    servise girer, iki taşıyıcı da onu çağırır. 24 Ağustos'ta bu kural delinmişti ve
    kopyalar sessizce ayrışmıştı: mobil "reddet" iadeyi ve slot temizliğini
    atlıyordu, mobil "teslim aldım" mühürleri hiç atamıyordu.
- **Para yalnızca `PaymentService`** ile değişir; `PaymentLog` elle yazılmaz.
  Sağlayıcı port/adapter: `src/lib/payments/`. Tutarlar `Decimal`; istemciye
  `moneyToNumber` ile çıkar.
- **Zamanlanmış işler `src/lib/jobs/registry.ts`**'e kaydedilir; crontab ve sağlık
  kontrolü oradan türer.
- **Modal** çizen her bileşen `useModalBehavior` + `role="dialog"` taşır
  (`modal-a11y.test.ts`). Yıkıcı onay için `ConfirmDialog`.
- **E-posta HTML'i** `renderEmailHtml` ile çizilir (`src/lib/email-template.ts`);
  şablonlarda elle `<div style=...>` yazılmaz. Dil haritaları `pickLocale` ile
  seçilir ve her dili taşımak zorundadır (`notification-locale-coverage`).
- **Yetki** kapısı `src/lib/action-auth.ts` (`requireAdmin`/`requirePartner`/
  `assertAdmin`); action içinde elle rol kontrolü yazılmaz. Mobil uçlarda
  `requireMobileUser` — o FIRLATMAZ, `{ error }` döndürür.
- **Mobil yanıt gövdeleri** `src/lib/mobile-dto.ts`'te; uçta elle alan listesi kurulmaz.
- **Ateşle-unut promise HER ZAMAN `.catch` taşır** (`void x().catch(...)`).
  Yakalanmamış red Node'da süreci düşürür: bir bildirim hatası tüm sunucuyu
  indirir. Mandal `unhandled-rejection`, tavan 0.
- **Dış HTTP çağrısı `fetchWithTimeout`** (`src/lib/async-timeout.ts`) ile yapılır —
  o isteği gerçekten iptal eder. `withTimeout` yalnızca yarışır ve soketi açık
  bırakır; iptal edilemeyen işler (Resend SDK, `src/lib/mail.ts`) için kalır.
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
| `src/__tests__/service-layer-writes.test.ts` | servis dışından doğrudan Prisma yazma |
| `src/__tests__/raw-error-copy.test.ts` | kullanıcıya basılan ham hata metni / sarkan `Errors.*` |
| `src/__tests__/notification-locale-coverage.test.ts` | e-posta şablonunda eksik dil |
| `src/__tests__/guest-contact.test.ts` | taşıyıcının kendi bildirim-alıcısı kuralını yazması |
| `src/__tests__/action-auth.test.ts` | elle yazılmış yetki kontrolü |
| `src/__tests__/mobile-dto.test.ts` | uçta elle kurulan yanıt gövdesi |
| `src/__tests__/unhandled-rejection.test.ts` | sunucuda `.catch`'siz ateşle-unut promise (tavan **0**) |

Tavan sayısını yükselten bir PR, sorunu çözmüyor, saklıyor.

## Nerede ne var

- Kanıtlı hata kuyruğu: `docs/DEFECT_BACKLOG.md` (tek iş listesi; `PRODUCTION_BACKLOG`
  stratejik dilek listesidir).
- Ödeme mimarisi `docs/PAYMENTS.md`, iş kuralları `docs/PLATFORM_SETTINGS.md`,
  cron/sağlık `scripts/README.md`, deploy `docs/DOCKER.md` + `ops/README.md`.
- CI/CD `docs/CI_CD.md` — tek workflow `.github/workflows/ci.yml`
  (`verify` → `image` → `deploy`). Deploy doğrulamaya `needs` ile bağlı, yani
  kırmızı commit üretime çıkamaz. Actions kotası bitince job'lar 0 adımda düşer
  ve hiç log bırakmaz; o tabloyu kodda aramayın, belgede yazıyor.
- Prod: `main` push → GHCR → deploy.
  AWS (`infra/aws`) paralel deneme ortamıdır, prod değil.

## Yapma

- `typescript.ignoreBuildErrors`, `unknown`→`any` regex düzeltmeleri, `as any`.
- Seed'i prod'a karşı çalıştırma (`seed-guard`).
- Git'e ekran görüntüsü, log dökümü, çerez dosyası (`.gitignore` kökte `*.png`/`*.txt` engeller).

## Mobil (Flutter) ve agent araçları

- `mobile/` içinde çalışırken `mobile/CLAUDE.md` yüklenir: komutlar, mandal, cihaz kısıtları.
- Skill'ler: `/mobil-dogrula` (kapı), `/mobil-cihaz` (gerçek cihaz + screencap),
  `/mobil-ekran`, `/mobil-api-ucu` (web↔mobil aynı servis), `/mobil-paket`, `/commit`.
- MCP (`.mcp.json`): `dart` (Dart/Flutter resmi MCP: analyze, test, hot reload, widget
  inspector, driver) ve `context7` (Riverpod 3 / go_router 17 / Next.js güncel doküman).
- Hook'lar (`.claude/settings.json`): `.dart` düzenlemesi otomatik `dart format`;
  define'sız ya da bagajpark.com'a giden `flutter run` engellenir.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
