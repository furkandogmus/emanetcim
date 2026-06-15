## Why

BagajPark hem web (Next.js PWA) hem de Flutter mobil uygulamasına sahip olmasına rağmen kullanıcı deneyimi "web-based" hissettiriyor. Mobil uygulama native gibi davranmalı; touch gesture'lar, bottom sheet'ler, swipe navigation, offline destek, haptic feedback ve native platform pattern'leri ile rakipsiz bir mobil deneyim sunmalı. Web tarafı da PWA olarak mobil-first olmalı.

## What Changes

1. **Flutter mobil uygulaması** — native mobile pattern'lere tam uyum: bottom sheet'ler, swipe gesture'lar, platform-adaptive widget'lar, image gallery'de pinch-to-zoom, iOS ve Android platformlarına özel davranışlar
2. **Web PWA** — gerçek bir mobil uygulama hissi: offline caching, bottom sheet search panel, iOS input zoom fix, haptic feedback, touch gesture'lar, pull-to-refresh, manifest zenginleştirme (screenshots, shortcuts)
3. **Mobil API** — mobil uygulama ihtiyaçlarına yönelik API iyileştirmeleri
4. **Ortak bileşenler** — hem web hem mobilde tutarlı UX pattern'leri

## Capabilities

### New Capabilities
- `mobile-gestures`: Touch gesture sistemi — swipe-back, swipe-to-dismiss, pull-to-refresh, pinch-to-zoom
- `mobile-bottom-sheets`: Bottom sheet pattern kütüphanesi — search panel, filter panel, date picker
- `pwa-offline-strategy`: Service worker caching stratejisi — sayfalar ve API yanıtları için offline destek
- `native-feedback`: Haptic feedback ve mikro-interaction sistemi
- `mobile-keyboard-aware`: Klavye açıldığında form ve CTA davranışını yönetme
- `mobile-share-api`: Native share sheet entegrasyonu
- `mobile-push-notifications`: Bildirim abonelik UI ve yönetimi

### Modified Capabilities
- `mobile-navigation`: Mobil navigasyon — MobileNav her sayfada görünür, back gesture desteği
- `mobile-datetime-picker`: DateTimePicker — native bottom sheet formatına dönüşüm
- `pwa-manifest`: Manifest dosyası — screenshots, shortcuts, id alanları eklendi
- `mobile-search-layout`: Search panel — desktop sidebar'dan mobile bottom sheet'e dönüşüm

## Impact

- **Web**: `src/app/[locale]/` — layout, search, shop detail, checkout, login sayfaları
- **Mobile**: `mobile/lib/` — search, shop detail, checkout, auth ekranları
- **API**: `src/app/api/mobile/` — gerekirse yeni endpoint'ler
- **Dependencies**: `@ducanh2912/next-pwa` (web), `flutter_animate` (mobile)
- **Service Worker**: `public/sw.js` — yeniden yazılacak
- **Manifest**: `public/manifest.json` — genişletilecek
