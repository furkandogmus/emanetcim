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
| İzinler | Yalnızca internet, ağ/Wi-Fi durumu, titreşim, **ön planda** konum, kamera (esnafın QR okutması) ve bildirim. Mikrofon, arka plan konumu, depolama ve biyometrik `app.json` → `blockedPermissions` ile çıkarıldı. (Manifest'te görülen `android.permission.DUMP` istenen bir izin değil; AndroidX ProfileInstaller alıcısının koruma izni, her uygulamada bulunur.) |
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

**Uygulama içeriği → Veri güvenliği** (uygulamanın bugün gerçekten yaptığı; formu bu tabloya göre doldur):

| Veri | Toplanıyor mu | Amaç | Not |
|---|---|---|---|
| E-posta adresi | Evet, zorunlu | Hesap yönetimi | E-postayla kod girişi ve Google ile giriş |
| Ad, telefon | Evet | Hesap yönetimi, uygulama işlevi | Telefon girişi (şifreyle) ve esnaf iletişimi |
| Fotoğraflar | Evet, isteğe bağlı | Uygulama işlevi | Profil ve dükkan vitrin fotoğrafı sunucuya yüklenir. İzin yok: seçici sistem arayüzünü kullanır |
| Yaklaşık / kesin konum | Evet, isteğe bağlı | Uygulama işlevi (yakındaki noktalar) | Yalnızca "Konumumu kullan"a basınca; arama isteğiyle sunucuya gider. Sunucunun saklayıp saklamadığını `shops/nearby` ve `geocode` uçlarında teyit et. Yalnızca ön planda |
| Cihaz veya diğer kimlikler | Evet | Analitik (tekil kullanıcı sayacı), uygulama işlevi (bildirim) | (1) Cihazda üretilen rastgele kurulum kimliği (`installId`) + platform + sürüm günde bir `/ping` ile gider ve girişliyse hesaba bağlanır. (2) Bildirim için FCM (Android) / Expo push (iOS) belirteci hesaba bağlı saklanır |
| Rezervasyon geçmişi, esnaf kazancı | Evet | Uygulama işlevi | Hesaba bağlı |
| Ödeme bilgisi | Hayır | — | Ödeme dükkanda |
| Reklam kimliği, üçüncü taraf analitik SDK'sı | Hayır | — | Reklam/analitik SDK'sı yok; sayaç kendi sunucumuza gider |

- Aktarımda şifreleme: **Evet** (HTTPS).
- Kullanıcı silme talebi: **Evet** — uygulama içi + `https://bagajpark.com/tr/contact`.
- Üçüncü taraflarla paylaşım: **Hayır** (Google ile giriş ve harita altlığı kullanıcının kendi eylemiyle Google/OpenFreeMap'e gider). Bildirim sağlayıcıları (Google FCM, Expo) işlemci olarak sayılır.
- Gizlilik politikası metninin bu tabloyla aynı şeyleri söylediğini her sürümden önce kontrol et.

**Diğer zorunlu formlar:** İçerik derecelendirme anketi, hedef kitle (yetişkin; çocuklara
yönelik değil), reklam içeriyor mu (hayır), uygulama erişimi (inceleme ekibi için bir
test hesabı: OTP girişi e-postaya kod gönderdiği için Google'a erişebildiğiniz bir test
e-postası verin).

**Mağaza girişi:** 512×512 ikon (`assets/icon.png`), 1024×500 öne çıkan görsel, en az iki
telefon ekran görüntüsü (Türkçe arayüzden alınması önerilir).

## Bu sürümde bilerek olmayanlar

Online ödeme (ödeme dükkanda), fiziksel mühür (henüz dağıtılmadı, `SEALS_ENABLED` kapalı),
SMS ile giriş (telefon girişi yalnızca şifreyle) ve Apple ile giriş (`extra.appleSignIn`
kapalı; iOS yayınından önce açılacak). Push bildirimi, QR okutma, check-in, esnaf kazanç
ve takvim ekranları, Google ile giriş uygulamada vardır. Flutter uygulaması 2026-10-18'de
kaldırıldı; tek istemci Expo.

## Hızlı yayın (2026-11-17'den beri)

EAS bulut kuyruğu ve `eas submit` kuyruğu ücretsiz planda saatlerce bekleyebiliyor. İki yol:

- **Native değişiklik (yeni paket, izin, `app.json`)** → yeni derleme:
  `app.json`'da `version`'ı artır, `release-notes.tr.txt`'yi güncelle, sonra
  `npm run release:android`. Yerelde imzalı `.aab` üretir (anahtar EAS'tan), Play
  Developer API ile kapalı teste (alpha) tamamlanmış sürüm olarak gönderir. İç test için
  `TRACK=internal npm run release:android`.
- **Yalnızca JS/görsel/metin** → derleme ve Play incelemesi yok:
  `npm run update:production -- --message "kısa açıklama"`. Aynı `version`'a sahip
  derlemeler bir sonraki açılışta alır (`runtimeVersion: appVersion`). İlk OTA,
  `expo-updates` içeren ilk derlemeden sonra çalışır.
  **Doğrudan `eas update` çalıştırma:** `eas.json`'daki derleme `env`ini okumaz ve EAS'ta
  ortam değişkeni yok; 2026-11-18'de yayınlanan güncelleme API adresi olarak `10.0.2.2`
  taşıdı. Script değerleri `eas.json` production profilinden alır, eksikse durur.
  Script ayrıca temiz çalışma ağacı, güncel `main` ve `npm run verify` ister, `eas-cli`
  sürümünü sabit tutar (`EAS_CLI_VERSION`).
  **Native değişiklik OTA ile gitmez:** `runtimeVersion` `appVersion` politikasında; native
  bir şeyi (paket, izin, `app.json` eklentileri) değiştirdiysen `version`'ı artırıp yeni
  derleme çıkar, yoksa eski derlemeler uyumsuz JS alır.

**Zorunlu güncelleme ve OTA bildirimi:** uygulama açılışta `/api/mobile/config`'i okur;
yüklü derlemenin sürümü `minAppVersion`un altındaysa "Güncelleme gerekli" ekranı Play
bağlantısıyla çıkar (admin panelinden `minAppVersion`u yükselt; ağ yoksa kapı açık kalır).
Uygulama ön plana her dönüşte yeni OTA'yı indirir ve hazır olunca "Yeni sürüm hazır,
yenile" şeridi gösterir; yeniden başlatma kullanıcının dokunuşuyla olur.

`eas update:configure` çalıştırma: `app.json`'daki izin listesini çözülmüş yapılandırmayla
ezip mikrofon, arka plan konumu, depolama gibi izinler ekliyor (2026-11-17'de görüldü).
