# 🤖 AI Agent Rehberi: Emanetçi (BagajPark) Projesi Onboarding Kılavuzu

Bu dosya, projede geliştirme, hata ayıklama (debugging) veya kod analizi yapacak yapay zeka asistanlarının (AI Agents) projeyi en hızlı şekilde anlaması ve doğru dosyalara yönlenmesi için tasarlanmış bir haritadır.

---

## 1. Proje Özeti ve Temel İş Kuralları

**Emanetçi (BagajPark)**, seyahat eden gezginlerin (misafirlerin) bagajlarını güvenli yerel dükkanlara (esnaflara / iş ortaklarına) emanet etmesini sağlayan bir **luggage storage marketplace (bagaj depolama pazar yeri)** uygulamasıdır.

*   **Uçtan Uca Süreç:** Misafir Haritadan Arayıp Öder (`PAID`) ➡️ Esnafa Gelir ➡️ Esnaf Valize Plastik Mühür Takıp Fotoğraf Çekerek Teslim Alır (`CHECKED_IN`) ➡️ Misafir Almaya Gelir ➡️ Esnaf Mührü Kontrol Edip Teslim Eder (`COMPLETED`) ➡️ Esnafın Hakedişi Cüzdanına Eklenir.
*   **Temel Limitler:** Standart sigorta teminatı valiz başına **5.000 TL**'dir. Fiyatlandırma ve iptal kesintisi gibi kurallar `PlatformSettings` tablosunda dinamik olarak tutulur.

---

## 2. Teknoloji Yığını (Tech Stack)

*   **Framework:** Next.js 15+ / 16 (App Router, TypeScript)
*   **Veritabanı ve ORM:** PostgreSQL, Prisma ORM
*   **Kimlik Doğrulama:** Auth.js (NextAuth) (Web kullanıcıları) & Özel JWT + `isBanned` Önbellek Sistemi (Mobil esnaf API'si)
*   **SMS & OTP İletişimi:** Netgsm SMS API
*   **Stil:** Vanilla CSS

---

## 3. Kritik Kod Yapısı Haritası

Projeyle ilgili çalışırken bakılması gereken ana klasörler ve kritik dosyalar aşağıda listelenmiştir:

### ⚙️ İş Mantığı (Core Services) ➡️ `src/services/`
*   [BookingService.ts](file:///Users/furkan/emanetcim/src/services/BookingService.ts): Rezervasyon durumları, check-in, check-out ve iptal lojiği.
*   [SealService.ts](file:///Users/furkan/emanetcim/src/services/SealService.ts): Bagajların teslim alınırken bağlandığı fiziksel mühür numaralarının ve kanıt fotoğraflarının (`photoUrl`) yönetimi.
*   [NotificationService.ts](file:///Users/furkan/emanetcim/src/services/NotificationService.ts): Kullanıcılara ve esnafa giden SMS'ler, doğrulama kodları (OTP).
*   [PricingService.ts](file:///Users/furkan/emanetcim/src/services/PricingService.ts): Boyut katsayıları ve gün sayısına göre dinamik sepet hesaplama.
*   [ShopService.ts](file:///Users/furkan/emanetcim/src/services/ShopService.ts): Esnaf dükkan koordinatları, harita sorguları ve kapasite durumları.

### 🌐 API ve Yönlendirmeler ➡️ `src/app/api/`
*   `api/mobile/`: Mobil uygulamaya (özellikle partner paneline) hizmet veren JWT korumalı endpoint'ler.
*   `api/internal/`: Vercel cron veya internal servislerin tetiklediği hatırlatıcı ve istatistik API'leri.

### 🛡️ Güvenlik ve Kimlik Doğrulama
*   [mobile-auth.ts](file:///Users/furkan/emanetcim/src/lib/mobile-auth.ts): Mobil API istekleri için JWT doğrulama. Esnaf ban/yasaklanma kontrolleri için 30 saniyelik veritabanı önbellek mekanizması (`getMobileSession`) buradadır.
*   [auth.config.ts](file:///Users/furkan/emanetcim/src/auth.config.ts): Web arayüzü kullanıcı giriş ve telefon numarası format normalizasyon ayarları.

---

## 4. Dokümantasyon Dizini (`docs/`)

Geliştirme yaparken iş kuralları ve mimari detaylar için şu dokümanları referans alabilirsiniz:

*   [uygulama_akislari_ve_use_cases.md](file:///Users/furkan/emanetcim/docs/uygulama_akislari_ve_use_cases.md): Tüm durum geçişleri, Mermaid akış diyagramları ve 28 kullanım senaryosu (Use Cases).
*   [rakip_analizi.md](file:///Users/furkan/emanetcim/docs/rakip_analizi.md): Sektördeki Bounce, LuggageHero gibi rakiplerle özellik ve model bazlı karşılaştırma.
*   [prd_tam_kapsam_tr.md](file:///Users/furkan/emanetcim/docs/prd_tam_kapsam_tr.md): Genel ürün gereksinim dokümanı (PRD).
*   [PLATFORM_SETTINGS.md](file:///Users/furkan/emanetcim/docs/PLATFORM_SETTINGS.md): Sistem kurallarının yönetimi.
*   [FINANCE_LEDGER.md](file:///Users/furkan/emanetcim/docs/FINANCE_LEDGER.md): Finansal hakediş ve mutabakat yapısı.

---

## ⚠️ AI Agent'lar İçin Kritik Geliştirme Kuralları

1.  **Telefon Numarası Formatı:** Telefon numaraları her zaman Türkiye formatına göre normalize edilmeli (`+90...` veya `0...` durumları kontrol edilmeli), veri tutarlılığı bozulmamalıdır.
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
*   **Hızlı Güncelleme Komutu (Sunucuda):**
    ```bash
    cd "$APP_DIR" && ./scripts/vm-update.sh
    ```

---

## 🛠️ Spec-Driven Development (OpenSpec)

Bu projede AI asistanlarıyla yapılan geliştirmelerin daha güvenilir, izlenebilir ve tutarlı olması için **OpenSpec** entegrasyonu bulunmaktadır.

### OpenSpec Yapısı ve Komutlar
Projeyi geliştiren AI asistanları (Cursor, Claude Code, Cline, Windsurf, Antigravity vb.) aşağıdaki slash komutları veya iş akışlarını kullanarak geliştirmeleri adım adım yürütebilir:

*   **/opsx:propose** `<fikir/görev>`: Yeni bir geliştirme için `openspec/changes/<change-adi>/` altında teklif (proposal) ve görev listesi (tasks.md) şablonu oluşturur.
*   **/opsx:apply**: Oluşturulan görev listesini sırayla uygular ve geliştirir.
*   **/opsx:archive**: Geliştirme tamamlandıktan sonra yapılan değişiklikleri arşivler ve genel sistem spesifikasyonlarını günceller.

Tüm OpenSpec dosyaları `openspec/` dizini altında tutulur ve Git üzerinden takip edilir.
