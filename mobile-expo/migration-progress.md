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

- [ ] Esnaf: teslim al (`bookings/[id]/check-in`) — yazıldı; prod'da `SHOP_CLOSED` doğru çevrildi, başarılı yol dükkan açılınca (08:00 TRT) doğrulanacak. QR okutma (`seals/scan`) yok
- [ ] Esnaf: teslim et (`bookings/[id]/check-out`) — yazıldı, mühür sağlamlık onayı web `CheckoutSealsDialog` ile aynı; prod doğrulaması bekliyor
- [ ] Esnaf: valiz revizyonu (`partner/bookings/[id]/bag-revision`)
- [ ] Esnaf: mühür talebi / arızalı bildir (`/partner/seals`)
- [ ] Kayıt + şifre sıfırlama (`/register`, `/auth/forgot-password`, `/auth/new-password`, `/auth/verify-email`)
- [ ] Google / Apple girişi (`auth/google`, `auth/apple`)
- [ ] Rezervasyon değiştir (`bookings/[id]/modify`)
- [ ] Değerlendirme yaz (`reviews`) — dükkan yorumlarını okuma 2026-10-18'de eklendi
- [ ] İtiraz aç (`/bookings/[id]/dispute`)
- [ ] Push bildirim kaydı (`push/register`)

## Admin (2026-10-18 yerel inceleme; uygulama yayından sonra)

Flutter'da 3 ekran var: pano (sayılar), başvurular (onayla/reddet), mesajlar
(okundu/sil). Mobil uçlar hazır ama şu eksikleri var; Expo ekranından ÖNCE
sunucuda düzeltilir:

- [ ] `admin/applications/[id]/[action]`: web `approveShopAction`/`rejectShopAction`
  denetim kaydı yazıyor (`shop.approve_application`, `shop.reject_application`),
  mobil uç yazmıyor. Reddetmek dükkanı SİLER; izsiz olmamalı.
- [ ] Aynı uç ham İngilizce cümle dönüyor ("Shop not found."); istemci çeviremez.
  Kod olmalı: `not_found`, `missing_coordinates`, `has_active_bookings`.
- [ ] `admin/applications` GET ham Prisma `Shop` dönüyor (bütün kolonlar, `Decimal`
  string). `mobile-dto.ts`'e DTO.
- [ ] `admin/messages/[id]` PATCH/DELETE olmayan id'de Prisma P2025 → 500; 404 olmalı.

Expo:
- [ ] ADMIN girişte `(admin)` grubuna: pano (`admin/stats`), başvurular, mesajlar.
  Reddet = dükkan silme → yıkıcı onay penceresi.
- [ ] Mesaja e-postayla cevap yalnızca web'de (`replyToContactMessageAction`, Resend).

## nativize-later

- [ ] Esnaf kazançları (`/partner/earnings`)
- [ ] Esnaf ayarları + haftalık saatler (`/partner/settings`, `partner/shop/schedule`)
- [ ] Esnaf panosu (`/partner`)
- [ ] Davet kodu (`referrals/*`)

## Tarayıcıda aç (native değil, `expo-web-browser`)

İçerik sayfaları; native yazmanın getirisi yok.

about, faq, how-it-works, cancellation, contact, insurance, terms, privacy, kvkk,
blog, blog/[slug], become-partner, esnaf, esnaf/nasil-calisir

## Yalnızca web (mobilde yok)

- `admin/*` (27 sayfa) — Flutter'da admin vardı; Expo'ya alınmıyor
- `bookings/lookup`, `bookings/manage/[token]` — hesapsız misafir, e-posta bağlantısıyla gelir
- `luggage-storage`, `luggage-storage/[slug]`, `hotels`, `partners`, `demand`, `[...slug]` — SEO/pazarlama
- `auth/error`
