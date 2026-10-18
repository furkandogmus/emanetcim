# Web → Expo geçiş listesi

`expo-web-to-native` skill'inin iş listesi. Her tur en üstteki işaretsiz
**nativize-now** maddesini alır, web ile emülatörde yan yana doğrular, işaretler.

Envanter: 2026-10-18, `src/app/**/page.tsx` (70 sayfa) ↔ `mobile-expo/src/app` (14 ekran).

## Kararlar

- **Backend yerinde kalır.** Uygulama `/api/mobile/*` istemcisidir; uçlar web ile aynı
  servisleri çağırır. Yeni iş kuralı mobil uçta değil `src/services/`'te yazılır.
- **DOM kabuğu (skill'in 3. adımı) atlanır.** Web sayfaları Prisma okuyan async Server
  Component; `'use dom'` içinde çalışamazlar. Eksik ekran doğrudan native yazılır.
- **Ödeme:** fiziksel hizmet (valiz emanet), mağaza IAP zorunluluğu yok.
- **Expo Go yetmez:** MapLibre native modül; development build (`npx expo run:android`).
- **Doğrulama yalnızca Android** (`bagajpark_pixel8` AVD); makinede Xcode yok.
  Web tarafı `agent-browser` ile, yerel `npm run dev` ya da prod salt-okunur sayfalar.
- **Pass ölçütü:** aynı veri, aynı davranış, aynı hata kodları. Piksel değil.

## 0 · Var olan ekranları doğrula (önce bu — hatalar burada)

Expo'da zaten olan ekranlar web karşılığıyla çalışırken karşılaştırılır. Bulunan
her hata buraya `— hata: <ne>` diye eklenir.

- [x] login (`/login`) — 2026-10-18 prod: e-posta+şifre girişi eklendi (Play inceleme hesabı da bununla girer). OTP aynen duruyor
- [x] home (`/[locale]`) — 2026-10-18 prod, tr+en
- [x] search (`/search`) — 2026-10-18 prod. Serbest metinle şehir/adres araması yok (web'de var); popüler şehir + konum
- [x] map — 2026-10-18 prod. Altlık ilk açılışta 1-2 sn geç geliyor (OpenFreeMap), hata değil
- [x] shop/[id] — 2026-10-18: web'deki boy boy fiyat ve yorumlar eklendi; adres tekrarı düzeltildi
- [x] checkout → success — 2026-10-18 prod: rezervasyon `740e72c4` oluştu, web'de aynı tutar/tarih görünüyor
- [x] bookings (`/bookings`) — 2026-10-18 prod
- [x] bookings/[id] + iptal — 2026-10-18 prod: `1a043d1a` iptal edildi. Rezervasyon kodu eklendi (web'deki gibi); iptal/biten rezervasyonda yol tarifi gizlendi
- [x] profile — 2026-10-18 prod (hesap silme denenmedi: test hesabını yok eder)
- [x] partner listesi — 2026-10-18 prod: gelmeyen misafirin eski APPROVED kaydı "Bugün"ü dolduruyordu → "Geçmiş"e
- [x] partner/[id] — teslim al / teslim et eklendi (aşağıda)

## Prod verisi bulguları (kod değil)

- **Test dükkanı kamuya açık.** `Kadıköy Valiz Emanet` (`d32ea037…`) test hesabı
  `maestro-partner`'a ait ama `isTest=false`, "Doğrulanmış" rozetiyle İstanbul aramasında
  en üstte. Gerçek misafirler buraya rezervasyon yapmış (Eylül–Ekim, en az 3 kişi).
  `isTest=true` yapılırsa uçtan uca test için rezerve edilemiyor (`checkout/intent` 404).

## nativize-now

Çekirdek akış: misafir → esnaf → mühür → teslim. Uçları hazır, ekranı yok.

- [x] Esnaf: teslim al — prod'da `740e72c4` CHECKED_IN (2026-10-18). QR okutma (`seals/scan`) eklendi
- [x] Esnaf: teslim et — prod'da `740e72c4` CHECKED_OUT (2026-10-18)
- [ ] Esnaf: valiz revizyonu (`partner/bookings/[id]/bag-revision`)
- [ ] Esnaf: mühür talebi / arızalı bildir (`/partner/seals`)
- [x] Şifre sıfırlama + profil düzenleme (kayıt OTP ile otomatik). OTP girişi artık e-postayı doğrulanmış sayar
- [ ] Google / Apple girişi — sunucu hazır; `GOOGLE_ANDROID_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID` (Google Cloud Console, Play imza SHA-1) ve `APPLE_BUNDLE_ID` + Apple Developer hesabı bekliyor
- [ ] Rezervasyon değiştir (`bookings/[id]/modify`)
- [ ] Değerlendirme yaz (`reviews`) — dükkan yorumlarını okuma 2026-10-18'de eklendi
- [ ] İtiraz aç (`/bookings/[id]/dispute`)
- [x] Push: esnafa yeni rezervasyon (FCM; `FIREBASE_SERVICE_ACCOUNT_JSON` SSM'de, 2026-10-18). iOS APNs Apple hesabı bekliyor

## Admin (2026-10-18 yerel inceleme; uygulama yayından sonra)

Flutter'da 3 ekran var: pano (sayılar), başvurular (onayla/reddet), mesajlar
(okundu/sil). Mobil uçlar hazır ama şu eksikleri var; Expo ekranından ÖNCE
sunucuda düzeltilir:

- [x] `admin/applications/[id]/[action]`: web `approveShopAction`/`rejectShopAction`
  denetim kaydı yazıyor (`shop.approve_application`, `shop.reject_application`),
  mobil uç yazmıyor. Reddetmek dükkanı SİLER; izsiz olmamalı.
- [x] Aynı uç ham İngilizce cümle dönüyor ("Shop not found."); istemci çeviremez.
  Kod olmalı: `not_found`, `missing_coordinates`, `has_active_bookings`.
- [x] `admin/applications` GET ham Prisma `Shop` dönüyor (bütün kolonlar, `Decimal`
  string). `mobile-dto.ts`'e DTO.
- [x] `admin/messages/[id]` PATCH/DELETE olmayan id'de Prisma P2025 → 500; 404 olmalı.

Expo:
- [x] ADMIN girişte `(admin)` grubuna: pano (`admin/stats`), başvurular, mesajlar.
  Reddet = dükkan silme → yıkıcı onay penceresi.
- [ ] Mesaja e-postayla cevap yalnızca web'de (`replyToContactMessageAction`, Resend).

## nativize-later

- [ ] Esnaf kazançları (`/partner/earnings`)
- [ ] Esnaf ayarları + haftalık saatler (`/partner/settings`, `partner/shop/schedule`)
- [ ] Esnaf panosu (`/partner`)
- [ ] Davet kodu (`referrals/*`)

## Arama

- [x] Serbest metinle adres/otel/semt arama (`GET /api/mobile/geocode`, web ile ortak `geocodePlace`)

## Tarayıcıda aç (native değil, `expo-web-browser`)

İçerik sayfaları; native yazmanın getirisi yok.

about, faq, how-it-works, cancellation, contact, insurance, terms, privacy, kvkk,
blog, blog/[slug], become-partner, esnaf, esnaf/nasil-calisir

## Yalnızca web (mobilde yok)

- `admin/*` (27 sayfa) — Flutter'da admin vardı; Expo'ya alınmıyor
- `bookings/lookup`, `bookings/manage/[token]` — hesapsız misafir, e-posta bağlantısıyla gelir
- `luggage-storage`, `luggage-storage/[slug]`, `hotels`, `partners`, `demand`, `[...slug]` — SEO/pazarlama
- `auth/error`

## Yerel uçtan uca tur 2 (2026-10-18)

Android, yerel API. Geçti: esnaf kazanç / mühür arızalı bildir / çalışma saatleri;
misafir değerlendirme / hasar bildirimi / değiştir (fiyat güncel fiyatla yeniden hesaplandı) /
iptal; admin pano / başvuru onayı (`shop.approve_application` denetim kaydı yazıldı) /
mesaj okundu / mesaj sil.

- hata (düzeltildi): admin mesaj silme düğmesinin ekran okuyucu etiketi onay başlığıydı
- hata (düzeltildi): değerlendirme / sorun formu ekranın altında, görünmeden açılıyordu
- hata (düzeltildi): ızgara dışı rezervasyon saati (05:54) değiştirme ekranında seçili görünmüyordu
- hata değil: silinen mesajın listede kalması Fast Refresh sonrası eski kapanıştan; temiz mount'ta doğru
- Emülatör notu: Expo dev menüsünün yüzen düğmesi sağ üstteki Profil'i örter; sürükleyip kenara çek

Sırada: iOS. Makinede Xcode yok → `eas-simulator` (bulut) ya da Xcode kurulumu; kullanıcı kararı.
