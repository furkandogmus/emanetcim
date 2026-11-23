# Web → Expo geçiş listesi

`expo-web-to-native` skill'inin iş listesi. Her tur en üstteki işaretsiz
**nativize-now** maddesini alır, web ile emülatörde yan yana doğrular, işaretler.

**Son durum (2026-11-23):** misafir, esnaf ve yönetici akışlarının tamamı native. Açık
kalan: iOS'ta Google ile giriş. Aracı programı (#207) ve esnaf ön kaydını dükkana çevirme
+ onayda slot üretimi (#208) birleşti; yönetici rol onayı ve yönetici push'u mobilde. iOS 0.3.4 (build 4) App
Review'da; Android sürümleri Play kapalı test izine çıkıyor. Sürüm/OTA ayrıntısı `PLAY_YAYIN.md`, iOS `IOS_YAYIN.md`.

İlk envanter: 2026-10-18, `src/app/**/page.tsx` (70 sayfa) ↔ `mobile-expo/src/app` (14 ekran).

## Kararlar

- **Backend yerinde kalır.** Uygulama `/api/mobile/*` istemcisidir; uçlar web ile aynı
  servisleri çağırır. Yeni iş kuralı mobil uçta değil `src/services/`'te yazılır.
- **DOM kabuğu (skill'in 3. adımı) atlanır.** Web sayfaları Prisma okuyan async Server
  Component; `'use dom'` içinde çalışamazlar. Eksik ekran doğrudan native yazılır.
- **Ödeme:** fiziksel hizmet (valiz emanet), mağaza IAP zorunluluğu yok.
- **Expo Go yetmez:** MapLibre native modül; development build (`npx expo run:android`).
- **Doğrulama Android emülatöründe** (`bagajpark_pixel8` AVD); makinede Xcode yok, iOS
  TestFlight derlemesiyle gerçek iPhone'da denenir. Web tarafı tarayıcıda, yerel
  `npm run dev` ya da prod salt-okunur sayfalar.
- **Pass ölçütü:** aynı veri, aynı davranış, aynı hata kodları. Piksel değil.

## 0 · Var olan ekranları doğrula (önce bu — hatalar burada)

Expo'da zaten olan ekranlar web karşılığıyla çalışırken karşılaştırılır. Bulunan
her hata buraya `— hata: <ne>` diye eklenir.

- [x] login (`/login`) — 2026-10-18 prod: e-posta+şifre girişi eklendi (Play inceleme hesabı da bununla girer). OTP aynen duruyor
- [x] home (`/[locale]`) — 2026-10-18 prod, tr+en
- [x] search (`/search`) — 2026-10-18 prod. Serbest metinle şehir/adres araması yok (web'de var); popüler şehir + konum
- [x] map — 2026-10-18 prod. Altlık ilk açılışta 1-2 sn geç geliyor (OpenFreeMap), hata değil
- [x] shop/[id] — 2026-10-18: web'deki boy boy fiyat ve yorumlar eklendi; adres tekrarı düzeltildi
- [x] checkout → success — 2026-10-18 prod: test rezervasyonu oluştu, web'de aynı tutar/tarih görünüyor
- [x] bookings (`/bookings`) — 2026-10-18 prod
- [x] bookings/[id] + iptal — 2026-10-18 prod: test rezervasyonu iptal edildi. Rezervasyon kodu eklendi (web'deki gibi); iptal/biten rezervasyonda yol tarifi gizlendi
- [x] profile — 2026-10-18 prod (hesap silme denenmedi: test hesabını yok eder)
- [x] partner listesi — 2026-10-18 prod: gelmeyen misafirin eski APPROVED kaydı "Bugün"ü dolduruyordu → "Geçmiş"e
- [x] partner/[id] — teslim al / teslim et eklendi (aşağıda)

## Prod verisi bulguları (kod değil)

- **Test dükkanı kamuya açıktı (2026-10-18).** Bir test hesabının dükkanı `isTest=false`
  olduğu için aramada görünüyor ve gerçek rezervasyon alıyordu; `isTest=true` yapılınca da
  uçtan uca test için rezerve edilemiyordu. Kod tarafı #200 ile çözüldü: `isTest` dükkanlar
  herkesten gizli, yalnızca `User.reviewSandbox` hesapları görür ve rezerve eder
  (`src/lib/public-shop-filter.ts`). Dükkanın kendisinin `isTest` işaretli olduğu admin
  panelinden doğrulanır.

## nativize-now

Çekirdek akış: misafir → esnaf → mühür → teslim. Uçları hazır, ekranı yok.

- [x] Esnaf: teslim al — prod'da test rezervasyonu CHECKED_IN (2026-10-18). QR okutma (`seals/scan`) eklendi
- [x] Esnaf: teslim et — prod'da test rezervasyonu CHECKED_OUT (2026-10-18)
- [x] Esnaf: valiz revizyonu (`partner/bookings/[id]/bag-revision`) — main'de
- [x] Esnaf: mühür talebi / arızalı bildir (`/partner/seals`) — main'de
- [x] Şifre sıfırlama + profil düzenleme (kayıt OTP ile otomatik). OTP girişi artık e-postayı doğrulanmış sayar
- [x] Google girişi (Android) — 2026-10-18
- [x] Apple ile giriş (iOS) — 2026-11-23, iPhone'da denendi; web'de de açık (#204, #205)
- [ ] Google ile giriş (iOS) — Google Cloud'da iOS OAuth istemcisi + `iosUrlScheme` bekliyor; iOS'ta düğme gizli
- [x] Rezervasyon değiştir (`bookings/[id]/modify`) — main'de
- [x] Değerlendirme yaz (`reviews`) — main'de
- [x] İtiraz / hasar bildirimi — main'de
- [x] Push: esnafa yeni rezervasyon (FCM; `FIREBASE_SERVICE_ACCOUNT_JSON` SSM'de, 2026-10-18). iOS: Expo push + APNs anahtarı EAS'ta (2026-11-23), iPhone'da bildirim geldi

## Admin (2026-10-18 yerel inceleme; uygulama yayından sonra)

İlk tur, eski Flutter uygulamasındaki üç ekranın karşılığı: pano (sayılar), başvurular
(onayla/reddet), mesajlar (okundu/sil). Expo ekranından önce sunucuda düzeltilenler:

- [x] `admin/applications/[id]/[action]`: web `approveShopAction`/`rejectShopAction`
  denetim kaydı yazıyor (`shop.approve_application`, `shop.reject_application`),
  mobil uç yazmıyor. Reddetmek dükkanı SİLER; izsiz olmamalı.
- [x] Aynı uç ham İngilizce cümle dönüyor ("Shop not found."); istemci çeviremez.
  Kod olmalı: `not_found`, `missing_coordinates`, `has_booking_history`.
- [x] `admin/applications` GET ham Prisma `Shop` dönüyor (bütün kolonlar, `Decimal`
  string). `mobile-dto.ts`'e DTO.
- [x] `admin/messages/[id]` PATCH/DELETE olmayan id'de Prisma P2025 → 500; 404 olmalı.

Expo:
- [x] ADMIN girişte `(admin)` grubuna: pano (`admin/stats`), başvurular, mesajlar.
  Reddet = dükkan silme → yıkıcı onay penceresi.
- [x] Mesaja e-postayla cevap (`POST admin/messages/[id]/reply`, web ile ortak `ContactReplyService`) — 2026-10-18

## nativize-later

- [x] Esnaf kazançları (`/partner/earnings`)
- [x] Esnaf ayarları + haftalık saatler (`/partner/settings`, `partner/shop/schedule`)
- [x] Esnaf panosu (`/partner`) — günlük özet kartı + çok dükkan seçimi (2026-10-18)
- [x] Davet kodu (`referrals/*`)

## Arama

- [x] Serbest metinle adres/otel/semt arama (`GET /api/mobile/geocode`, web ile ortak `geocodePlace`)

## Tarayıcıda aç (native değil, `expo-web-browser`)

İçerik sayfaları; native yazmanın getirisi yok.

about, faq, how-it-works, cancellation, contact, insurance, terms, privacy, kvkk,
blog, blog/[slug], become-partner, esnaf, esnaf/nasil-calisir

## Yalnızca web (mobilde yok)

- `admin/*` — 2026-11-22/23'te yönetim işlerinin çoğu mobile taşındı (aşağıda "Admin web → mobil"); web'de kalanlar raporlar ve toplu dışa aktarımlar
- `bookings/lookup`, `bookings/manage/[token]` — hesapsız misafir, e-posta bağlantısıyla gelir
- `luggage-storage`, `luggage-storage/[slug]`, `hotels`, `partners`, `demand`, `[...slug]` — SEO/pazarlama
- `auth/error`
- iOS'ta Google ile giriş: iOS OAuth istemcisi bekliyor, düğme gizli
- Mühür kanıt fotoğrafı: yalnızca web esnaf check-in'i (`SealService.uploadSealPhoto`); mobil
  check-in ucu fotoğraf almıyor (`docs/BACKLOG.md` B3 / C4)
- KVKK veri dışa aktarma (`/account/privacy`, `/api/account/data-export`); misafir hesabını
  uygulamadan siler, esnaf/yönetici "silme talebi" web iletişim sayfasını açar
- Yazdırılabilir QR afişi (`/partner/poster`)
- Yönetici: mühür envanteri, esnaf listesi, analitik, blog, kampanyalar, sorunlar, işler,
  bildirimler, esnaf adayları, durum (pano "Web paneli" bağlantısı)

Bilinçli farklar: uygulama yalnızca açık temada (`userInterfaceStyle: "light"`); ödeme
dükkanda, mağaza içi satın alma yok. (Eski `docs/web_vs_mobile_comparison.md` 2026-11-23'te
bu bölüme katıldı.)

## 2026-10-18 doğrulama turları (özet)

Yerel API'ye karşı Android emülatöründe, prod'a dokunmadan: tek kullanımlık PostGIS
konteyneri + `prisma migrate deploy` + seed, `npm run dev`, `PAYMENT_PROVIDER=manual`,
dev client `npx expo run:android` (API varsayılanı `10.0.2.2:3000`). Seed hesapları
`misafir@test.com` / `esnaf@test.com` / `admin@test.com`.

Geçen akışlar: misafir arama → rezervasyon → değiştir / iptal / değerlendirme / hasar
bildirimi; esnaf teslim al (mühürle) → teslim et, kazanç, mühür talebi / arızalı bildir,
çalışma saatleri, pano; admin pano, başvuru onayı (denetim kaydı yazılır), mesajlar.

Kalıcı sonuçlar:

- Çok dükkanlı esnafta mühür, dükkan ayarı ve fotoğraf uçları sırasız `findFirst` yerine
  web ile aynı `resolvePartnerShops(?shop=)` ile dükkan seçer; Expo'da seçili dükkan esnaf
  ekranları arasında ortaktır (`lib/partner-shop.tsx`). `partner/earnings/stats` bütün
  dükkanları bilerek toplar.
- Bu uçlar ve hesap silme ham metin yerine kod döner (`no_shop`, `active_bookings`).
- Takvim, tek gün seçiliyken ileri güne dokunulunca aralığı uzatır (`lib/date-range.ts`).
- Google ile giriş (Android): Firebase Android uygulamasında Play imzalama, yükleme ve
  debug SHA-1'leri kayıtlı; sunucuda istemci kimliği tanımsızsa `auth/google` 503 döner,
  audience kontrolü kapanmaz.
- `expo lint` başta yapılandırmasızdı ve hiçbir dosyayı taramıyordu (PR #66 ile düzeldi).
- Emülatör notları: argent `keyboard` Gboard'da metni karıştırabilir (`adb shell input text`);
  Expo dev menüsünün yüzen düğmesi sağ üstteki Profil'i örter.

## Admin web → mobil (2026-11-22/23)

Hedef: günlük yönetim web paneline girmeden telefondan yürüsün. Kural aynı: gövde
`src/services/`'te, web action'ı ve mobil uç aynı servisi çağırır.

- [x] Rezervasyon yönetimi: admin/esnaf/misafir iptali, gelmedi, süresi dolanı kapatma (#174–#176)
- [x] Duyuru gönderme: Esnaflar / Misafirler / Herkes, "Kendime test gönder" (#180, #182, #184)
- [x] Kullanıcılar: detay, rol değişikliği (ikinci admin onayı), anonimleştirme, denetim kaydı (#186)
- [x] Dükkanlar: fotoğraf, çalışma saatleri, yorum moderasyonu (#194)
- [x] Operasyon: itirazlar, kuponlar, ödemeler, platform ayarları, özellik bayrakları (#195)
- [x] İnceleme (App Review) hesabı anahtarı; test dükkanını yalnızca bu hesaplar görür (#200)
- [x] Mağaza ayarları: "iOS yayında" / "Android yayında" (#206)
- [x] Aracı (affiliate) programı: aracı ekle/onayla, oranlar, ödeme işaretleme (#207)
- [x] Esnaf ön kaydını tek adımda esnaf hesabı + dükkana çevirme (#208)
- [x] Rol onayları: ikinci admin bekleyen rol değişikliğini onaylar/reddeder; isteği açan
  onaylayamaz (`AdminUserService.approveRoleChange` / `cancelRoleChange`, web ile ortak)
- [x] Yönetici push'u: şikayet, esnaf başvurusu, ön kayıt, aracı başvurusu e-postanın yanında
  mobil cihazı kayıtlı yöneticilere de gider; dokununca ilgili ekran açılır

## Misafir ve esnaf akışları (2026-11-22/23)

- [x] Aramada şehirden sonra ilçe adımı ("Merkez" + dükkanı olan ilçeler); ana sayfa şehir
  kartından da açılır, adların baş harfi büyük (#192, #202, #203)
- [x] Bırakma saatine gecikme: +15/+30/+45 dk hatırlatma, +60 dk otomatik kapanış; esnafta
  "Misafiri bekle (+30 dk)" (#196). Zamanlayıcı `late-dropoff-scan`, 5 dakikada bir
- [x] Telefon numarası 0 ile gösterilir, arama +90 ile yapılır (#199)
- [x] Açılış animasyonu durgun logo beklemeden başlar; slogan "Valizini bırak, keyfine bak." (#197)
- [x] Esnaf için yazdırılabilir QR afişi (web, `partner/poster`) ve `bagajpark.com/app` akıllı
  indirme bağlantısı (#206)
- [x] Yeni dükkanın slotları onay anında üretilir (#208); eskiden yalnızca gece işi üretiyordu
- [x] Metin gerçeğe uyduruldu: mühür kapalı, check-in fotoğraf almıyor. Misafir "teslim alındı"
  push'u, web SSS/şartlar/güvence/nasıl çalışır "mühür + fotoğraf" demiyor; iOS'ta geçersiz
  telefon uyarısı Google girişi önermiyor

## iOS yayını (2026-11-23)

Makinede Xcode yok; build ve yükleme EAS ile (`IOS_YAYIN.md`). İlk build/submit Apple ID
girişi istediği için kullanıcının Terminal'inden; sonrakiler etkileşimsiz.

- [x] Apple Developer (bireysel), bundle `com.bagajpark`, App Store Connect kaydı
- [x] TestFlight: dahili grup, iPhone'da kurulum ve deneme
- [x] Sürüm 0.3.4 build 4 incelemeye gönderildi; yalnızca Türkiye, onaylanınca otomatik yayın.
  Build 3 geri çekildi: gömülü JS inceleme hesabının demo dükkanını ilk açılışta göstermiyordu
- [x] Yerel açılış ekranı 0.3.4'te boş; işaret animasyonla gelir (eski ikililer logodan başlar)
- bulgu (düzeltildi): sunucudaki `call-internal-job.sh` 2026-10-25'ten beri `.env` arıyordu,
  dosya `docker-compose.env`; hatırlatma, slot üretimi ve diğer gece işleri 4 hafta çalışmadı (#201)
