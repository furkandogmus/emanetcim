# AI Agent Rehberi: Emanetçi (BagajPark) ürün haritası

Bu dosya, projede çalışacak AI asistanlarının ürünü ve kod haritasını hızla kavraması içindir.
Çalışma kuralları (mimari, mandal testleri, commit) kök `CLAUDE.md`'dedir ve önceliklidir;
burada tekrarlanmaz.

---

## 1. Proje Özeti ve Temel İş Kuralları

**Emanetçi (BagajPark)**, seyahat eden gezginlerin (misafirlerin) bagajlarını güvenli yerel dükkanlara (esnaflara / iş ortaklarına) emanet etmesini sağlayan bir **luggage storage marketplace (bagaj depolama pazar yeri)** uygulamasıdır.

*   **Uçtan uca süreç:** misafir haritadan arayıp rezervasyon yapar (anında `APPROVED`; ödeme
    çoğunlukla dükkânda) → esnafa gelir → esnaf valize plastik mühür takıp (isteğe bağlı kanıt
    fotoğrafıyla) teslim alır (`CHECKED_IN`) → misafir almaya gelir → esnaf mührü kontrol edip
    teslim eder (`CHECKED_OUT`) → esnafın hakedişi kazanç defterine işlenir. Bırakma saatinden
    sonra gelmeyen misafire hatırlatma gider, +60 dk'da rezervasyon otomatik kapanır
    (`late-dropoff-scan`, esnaf "Misafiri bekle" ile uzatabilir).
*   **Temel Limitler:** Fiyatlandırma ve iptal kesintisi gibi kurallar `PlatformSettings` tablosunda dinamik olarak tutulur. **Valiz başına güvence tutarını buraya YAZMAYIN:** bu belge onu `5.000 TL` olarak sabitliyordu, oysa arayüz `10.000 TL` diyor — rakam bir noktada yükseltilmiş ve belge geride kalmıştı. Güncel değer çeviri dosyalarındadır (`Terms.a2`, `Guest.trustInsuranceBody`) ve tutarlılığı `src/__tests__/coverage-amount-consistency.test.ts` mandalıyla korunur.

---

## 2. Teknoloji Yığını (Tech Stack)

*   **Web:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4 (`src/app/[locale]/globals.css`)
*   **Mobil:** Expo / React Native (`mobile-expo/`, kuralları `mobile-expo/CLAUDE.md`)
*   **Veritabanı ve ORM:** PostgreSQL (PostGIS), Prisma ORM
*   **Kimlik doğrulama:** web Auth.js v5 (e-posta/şifre, Google, Apple); mobil jose JWT
    (`src/lib/mobile-auth.ts`, e-posta kodu / şifre / Google / Apple)
*   **Bildirim:** e-posta Resend, push FCM (Android) + Expo push (iOS) + web push; SMS (Netgsm)
    entegrasyonu geçici olarak kapalı (`src/lib/netgsm.ts`)
*   **Altyapı:** tek AWS EC2 VM'de Docker Compose, GHCR imajı, SSM ile deploy (`infra/aws`)

---

## 3. Kritik Kod Yapısı Haritası

Projeyle ilgili çalışırken bakılması gereken ana klasörler ve kritik dosyalar aşağıda listelenmiştir:

### ⚙️ İş Mantığı (Core Services) ➡️ `src/services/`
*   [BookingService.ts](src/services/BookingService.ts): rezervasyon cephesi; gövdeler `src/services/booking/` altında (create, check-in, check-out, lifecycle, closure, late-hold, partner-review, bag-revision).
*   [SealService.ts](src/services/SealService.ts): Bagajların teslim alınırken bağlandığı fiziksel mühür numaralarının yönetimi. `photoUrl` kanıt fotoğrafını taşır; adresi SUNUCU üretir (`SealService.uploadSealPhoto` → S3), istemciden gelmez. Fotoğraf isteğe bağlıdır.
*   [NotificationService.ts](src/services/NotificationService.ts): e-posta, push ve SMS bildirimleri.
*   [PricingService.ts](src/services/PricingService.ts): Boyut katsayıları ve gün sayısına göre dinamik sepet hesaplama.
*   [ShopService.ts](src/services/ShopService.ts): dükkan koordinatları, harita sorguları ve kapasite. Herkese açık dükkan filtresi `src/lib/public-shop-filter.ts` (`isTest` dükkanları yalnızca `reviewSandbox` hesapları görür).
*   Yönetici işleri: `AdminOpsService`, `AdminUserService`, `AdminPaymentsService`, `BroadcastService` — web paneli ve mobil yönetici ekranları aynı servisleri çağırır.

### 🌐 API ve Yönlendirmeler ➡️ `src/app/api/`
*   `api/mobile/`: Expo uygulamasının (misafir, esnaf, yönetici) JWT korumalı uçları.
*   `api/internal/`: sunucu crontab'ının `CRON_SECRET` ile tetiklediği zamanlanmış işler. Liste ve takvim `src/lib/jobs/registry.ts`'te; ayrıntı `scripts/README.md`.

### 🛡️ Güvenlik ve Kimlik Doğrulama
*   [mobile-auth.ts](src/lib/mobile-auth.ts): mobil JWT doğrulama. `requireMobileUser` her istekte kullanıcıyı veritabanından okur (rol, `isBanned`, `tokenVersion`); önbellek yok.
*   [auth.config.ts](src/auth.config.ts) + [auth-providers.ts](src/lib/auth-providers.ts): web girişi, telefon normalizasyonu, OAuth sağlayıcıları (Apple istemci sırrı anahtardan üretilir).

---

## 4. Dokümantasyon dizini

*   [URUN_VE_IS_KURALLARI.md](docs/URUN_VE_IS_KURALLARI.md): roller, rezervasyon yaşam döngüsü, iş kuralları, bildirim kanalları, dükkan/mühür işleyişi (kodla doğrulanmış tek ürün belgesi).
*   [PLATFORM_SETTINGS.md](docs/PLATFORM_SETTINGS.md): sayısal kurallar ve admin'den yönetimi.
*   [PAYMENTS.md](docs/PAYMENTS.md): ödeme mimarisi, defter, iptal/iade, finans dışa aktarma.
*   [DEFECT_BACKLOG.md](docs/DEFECT_BACKLOG.md): kanıtlı açık hatalar (tek iş listesi); [PRODUCTION_BACKLOG.md](docs/PRODUCTION_BACKLOG.md): stratejik liste ve yol haritası.
*   [rakip_analizi.md](docs/rakip_analizi.md): rakiplerle özellik karşılaştırması; [web_vs_mobile_comparison.md](docs/web_vs_mobile_comparison.md): web ↔ Expo eşliği.
*   Operasyon: [ops/README.md](ops/README.md), [scripts/README.md](scripts/README.md), [infra/aws/README.md](infra/aws/README.md), [docs/CI_CD.md](docs/CI_CD.md).
*   Eski tarihli denetimler ve anlık görüntüler repoda tutulmaz; git geçmişindedir.

---

## ⚠️ AI Agent'lar İçin Kritik Geliştirme Kuralları

1.  **Telefon numarası:** girişte Türkiye formatına normalize edilir (`+90…` / `0…`); ekranda `0` ile gösterilir, arama bağlantısı ülke koduyla gider.
2.  **Veritabanı Sorguları (N+1 Sorunu):** Prisma kullanırken döngüler içinde DB sorgusu atmaktan kaçının. `include` veya `select` kullanarak ilişkili verileri tek bir sorguyla çekin (örneğin esnaf kazanç/istatistik ekranları).
3.  **Mobil API Koruması:** `api/mobile` altındaki tüm partner/esnaf endpoint'lerinde mutlaka `requireMobileUser` çağrılarak yetkilendirme ve aktiflik/ban kontrolü yapılmalıdır.
4.  **Görsel ve Assetler:** Uygulamada rastgele dış kaynaktan stock fotoğraflar kullanılmamalıdır. Mümkün olduğunca yerel statik asset'ler tercih edilmelidir.

---

## 🖥️ Canlı Sunucu (Production Server) Bilgileri

Sunucu adresi, port, kullanıcı ve uygulama dizini artık bu dosyada **tutulmuyor** —
git'e commit edilen bir dosyada gerçek sunucu bilgisi bulunması güvenlik açısından
sakıncalı (recon bilgisi). Bu bilgiler git'e girmeyen `ops/server.env` dosyasında
tutulur (bkz. `ops/README.md`).

*   **Bağlantı bilgisi:** `ops/server.env` içindeki `SSH_HOST` / `SSH_PORT` / `SSH_USER`
*   **SSH Bağlantı Komutu:**
    ```bash
    source ops/server.env && ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST"
    ```
*   **Uygulama Dizini:** `ops/server.env` içindeki `APP_DIR`
*   **Deploy:** sunucuya normalde elle girilmez; `main`'e merge CI'da doğrulama → GHCR imajı →
    SSM ile deploy eder. CI kullanılamıyorsa sunucuda `cd "$APP_DIR" && ./scripts/update.sh`
    (`ops/README.md` § Deploy). Sunucudaki sır dosyası `docker-compose.env`'dir, `.env` yoktur.

---

## 🛠️ Spec-Driven Development (OpenSpec)

Bu projede AI asistanlarıyla yapılan geliştirmelerin daha güvenilir, izlenebilir ve tutarlı olması için **OpenSpec** entegrasyonu bulunmaktadır.

### OpenSpec Yapısı ve Komutlar
Projeyi geliştiren AI asistanları (Cursor, Claude Code, Cline, Windsurf, Antigravity vb.) aşağıdaki slash komutları veya iş akışlarını kullanarak geliştirmeleri adım adım yürütebilir:

*   **/opsx:propose** `<fikir/görev>`: Yeni bir geliştirme için `openspec/changes/<change-adi>/` altında teklif (proposal) ve görev listesi (tasks.md) şablonu oluşturur.
*   **/opsx:apply**: Oluşturulan görev listesini sırayla uygular ve geliştirir.
*   **/opsx:archive**: Geliştirme tamamlandıktan sonra yapılan değişiklikleri arşivler ve genel sistem spesifikasyonlarını günceller.

Biten öneriler repoda tutulmaz: 2026-11-23'te tamamlanan 12 öneri silindi (git geçmişinde).
Açık kalan tek öneri `mobil-harita-fiyat-pini`. `openspec/specs/` boş; güncel davranışın
kaynağı kod ve `docs/`.

Tüm OpenSpec dosyaları `openspec/` dizini altında tutulur ve Git üzerinden takip edilir.
