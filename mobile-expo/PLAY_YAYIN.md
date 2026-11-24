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
test hesabı: e-posta + şifreyle girer; kodla giriş için sunucuda `PLAY_REVIEW_EMAIL` +
`PLAY_REVIEW_OTP` tanımlıysa o adrese sabit kod geçerlidir, `src/app/api/mobile/auth/otp`).
Hesap test dükkanlarını görsün diye admin'den `reviewSandbox` açılır (`IOS_YAYIN.md`).

**Mağaza girişi:** 512×512 ikon (`assets/icon.png`), 1024×500 öne çıkan görsel, en az iki
telefon ekran görüntüsü (Türkçe arayüzden alınması önerilir).

## Bu sürümde bilerek olmayanlar

Online ödeme (ödeme dükkanda), fiziksel mühür (henüz dağıtılmadı, `SEALS_ENABLED` kapalı)
ve SMS ile giriş (telefon girişi yalnızca şifreyle). Push bildirimi, QR okutma, check-in,
esnaf kazanç ve takvim ekranları, yönetici ekranları ve Google ile giriş (Android)
uygulamada vardır; Apple ile giriş iOS'ta açık (`IOS_YAYIN.md`). Tek istemci Expo.

## Hızlı yayın (2026-11-17'den beri)

EAS bulut kuyruğu ve `eas submit` kuyruğu ücretsiz planda saatlerce bekleyebiliyor. İki yol:

- **Native değişiklik (yeni paket, izin, `app.json`)** → yeni derleme:
  `app.json`'da `version`'ı artır, `release-notes.tr.txt`'yi güncelle, sonra
  `npm run release:android`. Yerelde imzalı `.aab` üretir (anahtar EAS'tan), Play
  Developer API ile kapalı teste (alpha) tamamlanmış sürüm olarak gönderir. İç test için
  `TRACK=internal npm run release:android`.
- **Yalnızca JS/görsel/metin** → derleme ve Play incelemesi yok:
  `npm run update:production -- --message "kısa açıklama"` (kademeli yayın için başına
  `ROLLOUT=10`; sonra `eas update:edit` ile yüzde artırılır). Aynı `version`'a sahip
  derlemeler bir sonraki açılışta alır (`runtimeVersion: appVersion`). İlk OTA,
  `expo-updates` içeren ilk derlemeden sonra çalışır.
  Varsayılan runtime `app.json` → `version` (şu an `0.3.4`). Mağazada hâlâ kurulu eski
  ikililere (bugün `0.3.0`–`0.3.3`) aynı JS'i göndermek için her biri ayrı çağrıyla
  `OTA_RUNTIME=<sürüm>` ile yayınlanır; `verify` yalnızca ilk çağrıda koşar, sonrakiler
  `OTA_SKIP_VERIFY=1` ile aynı HEAD'in kaydını kullanır (betiğin başlığındaki örnek). Yalnızca
  ikililer arasında yerel değişiklik yoksa güvenlidir. Kanal ve runtime iOS ile ortaktır.
  **Doğrudan `eas update` çalıştırma:** `eas.json`'daki derleme `env`ini okumaz ve EAS'ta
  ortam değişkeni yok; 2026-11-18'de yayınlanan güncelleme API adresi olarak `10.0.2.2`
  taşıdı. Script değerleri `eas.json` production profilinden alır, eksikse durur.
  Script ayrıca temiz çalışma ağacı, güncel `main` ve `npm run verify` ister, `eas-cli`
  sürümünü sabit tutar (`EAS_CLI_VERSION`).
  **Native değişiklik OTA ile gitmez:** `runtimeVersion` `appVersion` politikasında; native
  bir şeyi (paket, izin, `app.json` eklentileri) değiştirdiysen `version`'ı artırıp yeni
  derleme çıkar, yoksa eski derlemeler uyumsuz JS alır.

**Zorunlu güncelleme ve OTA bildirimi:** uygulama açılışta `/api/mobile/config`'i okur;
yüklü ikilinin sürümü (`Updates.runtimeVersion`) `minAppVersion`un altındaysa "Güncelleme
gerekli" ekranı Play bağlantısıyla çıkar (`src/lib/app-update.ts`; admin → Platform
ayarları'ndan `minAppVersion`u yükselt; ağ yoksa kapı açık kalır). Bağlantı iOS'ta da Play'i
açar, App Store bağlantısı yok: `minAppVersion`u iOS kullanıcılarını kilitleyecek şekilde
yükseltme.
Uygulama ön plana her dönüşte yeni OTA'yı indirir ve hazır olunca "Yeni sürüm hazır,
yenile" şeridi gösterir; yeniden başlatma kullanıcının dokunuşuyla olur.

**OTA kod imzası (0.3.5+):** `app.json` → `updates.codeSigningCertificate`
(`certs/certificate.pem`, açık sertifika, repoda) ve `codeSigningMetadata`
(`keyid: main`, `alg: rsa-v1_5-sha256`). Özel anahtar repoda değil:
`~/Documents/personal/bagajpark-ota-signing/keys/private-key.pem` (yedeği parola
yöneticisinde tutulmalı). `npm run update:production` onu `--private-key-path` ile geçirir;
başka yerdeyse `OTA_SIGNING_KEY=/yol/private-key.pem`. Anahtarsız yayın durur.
- 0.3.5+ ikililer sertifikayı gömülü taşır ve imzasız ya da başka anahtarla imzalı
  güncellemeyi reddeder (gömülü JS'te kalır).
- 0.3.0–0.3.4 ikililerde sertifika yok; imza istemezler (`expo-expect-signature` başlığı
  göndermezler) ve EAS onlara güncellemeyi imza başlığı olmadan sunar. Aynı script
  `OTA_RUNTIME=0.3.4` ile de imzalı yayınlar, eski ikili imzayı yok sayar.
- Anahtar kaybolursa 0.3.5+ ikililere OTA gönderilemez; yeni sertifikalı bir native sürüm
  gerekir. Sertifika 2036-11-24'te dolar.

`eas update:configure` çalıştırma: `app.json`'daki izin listesini çözülmüş yapılandırmayla
ezip mikrofon, arka plan konumu, depolama gibi izinler ekliyor (2026-11-17'de görüldü).
