## Why

Expo uygulaması (`mobile-expo/`) Flutter'ın yerine Google Play'e çıkıyor (`com.bagajpark`).
Kod ve prod doğrulaması var, spec yok: bir sonraki değişiklik neyin bilerek böyle
olduğunu (anında onaylı rezervasyon, İstanbul saati, mühürün isteğe bağlı olması)
koddan çıkarmak zorunda kalıyor. 2026-10-18'de web ile ekran ekran karşılaştırılıp
(`expo-web-to-native`) prod'da test hesaplarıyla doğrulanan davranış burada yazılı.

## What Changes

Davranış değişikliği yok; mevcut davranışın sözleşmesi:

1. **Giriş** — e-posta OTP (ilk girişte hesap açar) ve e-posta + şifre; oturum ağ
   hatasında korunur.
2. **Arama penceresi** — saatler platform saatiyle (Europe/Istanbul), bayat pencere
   kendiliğinden ileri kayar, kalış en fazla 30 × 24 saat.
3. **Rezervasyon** — oluştur, gör (QR + rezervasyon kodu), iptal et; dükkan
   ekranında boy boy fiyat ve yorumlar.
4. **Esnaf teslimi** — teslim al (isteğe bağlı mühür), teslim et (mühür sağlamlık
   onayı), gelmeyen misafirin listeden düşmesi.

## Capabilities

### New Capabilities
- `mobile-auth`: OTP ve şifreyle giriş, oturumun saklanması ve kapanma koşulları
- `mobile-search-window`: Bırakma/alma penceresinin kurulması ve doğrulanması
- `mobile-booking`: Misafir rezervasyonu: oluşturma, görüntüleme, iptal
- `mobile-partner-handover`: Esnafın valizi teslim alması ve geri vermesi

## Impact

- **Mobile**: `mobile-expo/src/` (giriş, arama, harita, dükkan, rezervasyon, esnaf)
- **API**: `src/app/api/mobile/` — yeni uç yok; `shops/nearby` web aramasıyla aynı gün
  kapısını kullanır (PR #54)
- **Yayın**: Play dahili test izi; `mobile-expo/PLAY_YAYIN.md`
