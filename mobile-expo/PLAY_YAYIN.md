# Google Play'e yayın

Bu uygulamanın kabul kriteri: **Google Play'e sorunsuz yüklenebilir bir build.**
Kod tarafı hazır; aşağıdaki hesap adımları hesap sahibinin elinde.

## Hazır olanlar (yerelde doğrulandı)

| Gereksinim | Durum |
|---|---|
| Biçim | İmzalanabilir **AAB** (`eas.json` → `production`, `buildType: app-bundle`) |
| Paket adı | `com.bagajpark` — Play'de kalıcıdır, değişmez |
| Hedef SDK | 36 (Play'in güncel hedef SDK şartının üstünde) |
| Sürüm kodu | EAS sunucuda tutar ve her production build'de artırır (`autoIncrement`) |
| API adresi | Release'te `https://bagajpark.com/api/mobile`; şifresiz HTTP yalnızca debug'da |
| İzinler | Yalnızca internet, ağ/Wi-Fi durumu, titreşim, **ön planda** konum. Mikrofon, arka plan konumu, depolama ve biyometrik `app.json` → `blockedPermissions` ile çıkarıldı. (Manifest'te görülen `android.permission.DUMP` istenen bir izin değil; AndroidX ProfileInstaller alıcısının koruma izni, her uygulamada bulunur.) |
| Hesap silme | Uygulama içinde: Profil → "Hesabımı sil" (misafir). Esnaf: "Hesap kapatma talebi" → iletişim sayfası |
| Gizlilik politikası | `https://bagajpark.com/tr/privacy` (Profil ekranından da açılır) |
| Harita | Anahtarsız (OpenFreeMap); Google Maps anahtarı gerekmez |

## Hesap sahibinin yapacakları

1. **Expo hesabı ve proje kaydı** — bir kez:

   ```bash
   cd mobile-expo
   npx eas-cli@latest login
   npx eas-cli@latest init          # app.json'a projectId yazar; bu değişikliği commit'le
   ```

2. **Production build** — imza anahtarını EAS üretir ve saklar (ilk soruda "Generate new keystore"):

   ```bash
   npx eas-cli@latest build --platform android --profile production
   ```

   Çıktı: indirilebilir `.aab`.

3. **Play Console'da uygulamayı oluştur** — ad "BagajPark", varsayılan dil Türkçe, uygulama
   (oyun değil), ücretsiz. **Play App Signing**'i açık bırak.

4. **İlk AAB'yi elle yükle** — Test → Dahili test → yeni sürüm → `.aab`. Play, yeni bir
   uygulamanın ilk paketinin konsoldan yüklenmesini istiyor. Sonraki sürümler:

   ```bash
   npx eas-cli@latest submit --platform android --profile production   # dahili teste taslak
   ```

   (`eas submit` bir Google servis hesabı JSON'u ister; Expo dokümanı:
   "Creating a Google Service Account".)

5. **Kişisel geliştirici hesabıysa:** Kasım 2023'ten sonra açılan kişisel hesaplarda Play,
   üretime çıkmadan önce **en az 12 test kullanıcısıyla 14 gün kapalı test** şartı koyuyor.
   Şirket (organizasyon) hesabında bu şart yok. Takvimi buna göre planla.

## Play Console formları

**Uygulama içeriği → Veri güvenliği** (uygulamanın bugün gerçekten yaptığı):

| Veri | Toplanıyor mu | Amaç | Not |
|---|---|---|---|
| E-posta adresi | Evet, zorunlu | Hesap yönetimi (OTP girişi) | |
| Ad, telefon | Sunucuda varsa gösterilir | Hesap yönetimi | Uygulama bu ekranda istemiyor |
| Yaklaşık / kesin konum | Evet, isteğe bağlı | Uygulama işlevi (yakındaki noktalar) | Yalnızca "Konumumu kullan"a basınca; arama isteğiyle sunucuya gider. Sunucunun bunu saklayıp saklamadığını backend tarafında teyit et |
| Ödeme bilgisi | Hayır | — | Ödeme dükkanda |
| Analitik / reklam kimliği | Hayır | — | Uygulamada analitik SDK'sı yok |

- Aktarımda şifreleme: **Evet** (HTTPS).
- Kullanıcı silme talebi: **Evet** — uygulama içi + `https://bagajpark.com/tr/contact`.
- Üçüncü taraflarla paylaşım: Hayır.

**Diğer zorunlu formlar:** İçerik derecelendirme anketi, hedef kitle (yetişkin; çocuklara
yönelik değil), reklam içeriyor mu (hayır), uygulama erişimi (inceleme ekibi için bir
test hesabı: OTP girişi e-postaya kod gönderdiği için Google'a erişebildiğiniz bir test
e-postası verin).

**Mağaza girişi:** 512×512 ikon (`assets/icon.png`), 1024×500 öne çıkan görsel, en az iki
telefon ekran görüntüsü (Türkçe arayüzden alınması önerilir).

## Bu sürümde bilerek olmayanlar

Push bildirimi (Firebase `google-services.json` gerekiyor), mühür/QR okutma, check-in,
esnaf kazanç ve takvim ekranları, online ödeme, Google/Apple ile giriş. Flutter
uygulaması (`../mobile/`) bunları taşımaya devam ediyor.
