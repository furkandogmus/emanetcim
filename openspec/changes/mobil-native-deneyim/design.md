## Context

BagajPark iki uygulama yüzüne sahip: Next.js web uygulaması (PWA olarak çalışıyor) ve Flutter mobil uygulaması. Kullanıcı deneyimi her iki platformda da "web-like" hissediliyor: touch gesture eksikliği, desktop pattern'lerinin mobile taşınması (sidebar search panel), PWA offline desteğinin olmaması, iOS input zoom sorunları, ve native platform pattern'lerinden uzak duruş.

Flutter uygulaması teknik olarak native özelliklere sahip (haptic, push, biometric, offline) ancak bazı UI pattern'leri web-like kalıyor. Web (PWA) tarafı ise daha büyük iyileştirme gerektiriyor.

## Goals / Non-Goals

**Goals:**
- Web PWA'yı gerçek bir mobil uygulama gibi hissettirmek (offline, gesture, bottom sheet, haptic)
- Flutter uygulamasında native pattern'leri güçlendirmek (bottom sheet'ler, gesture'lar, platform adaptasyonu)
- Her iki platformda tutarlı kullanıcı akışları (search → shop detail → checkout → booking)
- Mobil performans ve kullanılabilirlik metriklerini iyileştirmek

**Non-Goals:**
- Mevcut backend API'lerini değiştirmek (mobil API endpoint'leri zaten mevcut)
- Yeni özellik eklemek (mevcut özelliklerin UX'ini iyileştirmek)
- Masaüstü deneyimini değiştirmek (sadece mobil odaklı)

## Decisions

### 1. Web PWA: Search Panel Bottom Sheet
**Karar**: Sidebar (`-translate-x-full`) → Bottom sheet pattern
**Neden**: Mobilde sidebar pattern'i kullanıcının harita bağlamını kaybetmesine neden oluyor. Google Maps, Airbnb, Uber gibi uygulamalar bottom sheet kullanıyor.
**Nasıl**: `SearchClient.tsx` — `aside`'i mobile'da `fixed bottom-0` bottom sheet'e çevir, desktop'ta sidebar olarak kal.
**Alternatif**: Drawer pattern — reddedildi çünkü map context'i tamamen kayboluyor.

### 2. Web PWA: Offline Stratejisi
**Karar**: `@ducanh2912/next-pwa` ile runtime caching
**Neden**: Mevcut `sw.js` sadece manifest ve ikonları cache'liyor. Next.js sayfaları ve API yanıtları için caching gerekli.
**Strateji**: 
- `/_next/static` → CacheFirst
- `/(tr|en)/search` → NetworkFirst (24s TTL)
- `/api/mobile/` → StaleWhileRevalidate
- Diğer sayfalar → NetworkFirst

### 3. Web PWA: Touch Gesture Sistemi
**Karar**: Custom hook tabanlı gesture sistemi (framer-motion zaten mevcut)
**Neden**: Web uygulamasında şu an hiç swipe gesture yok. Kullanıcılar native'de alışık oldukları swipe-back, swipe-to-dismiss, pull-to-refresh gibi interaction'ları bekliyor.
**Kapsam**: `useSwipeBack`, `usePullToRefresh`, `useSwipeToDismiss` custom hook'ları

### 4. Flutter: Platform Adaptive Widget'lar
**Karar**: iOS'ta Cupertino, Android'de Material widget'ları kullan
**Neden**: Flutter uygulaması şu an tamamen Material Design kullanıyor. iOS'ta Cupertino stilleri (AppBar, TabBar, ActionSheet) daha native hissettirir.
**Kapsam**: `Platform.isIOS` kontrolü ile `CupertinoPageScaffold` / `Scaffold` seçimi

### 5. Web PWA: DateTimePicker → Native Bottom Sheet
**Karar**: React DayPicker + TimePicker'ı mobilde bottom sheet içinde göster
**Neden**: Mevcut `DateTimePicker` desktop dropdown'ı gibi açılıyor, mobilde ekranı taşıyor veya dışarı taşıyor.
**Nasıl**: Mobilde (`max-width: 767px`) calendar + time chips'i bottom sheet olarak render et.

### 6. iOS Input Zoom Prevention
**Karar**: `globals.css` — mobil tüm input'larda `font-size: 16px` enforce et
**Neden**: iOS Safari font-size < 16px olan input'larda otomatik zoom yaparak kullanıcıyı formdan koparıyor.

## Risks / Trade-offs

- Bottom sheet pattern → Ekran alanı kullanımı azalır, ancak kullanılabilirlik artar
- Offline caching → Güncel olmayan veri gösterimi riski, `maxAgeSeconds` ile yönetilecek
- Gesture hook'ları → Framer-motion ile entegrasyon, performans etkisi minimal
- Platform adaptive → iOS ve Android arasında test yükü artar
- Bottom sheet DateTimePicker → Web uygulaması bundle boyutunu artırabilir, lazy loading ile çözülür
