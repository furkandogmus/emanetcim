## Why

Play dahili testte bildirildi (2026-10-18): "Noktalar geliyor da fiyatlar yazmıyor üstünde."
Mobil haritada her dükkan yalnızca bavul ikonlu bir daire; misafir fiyatı görmek için her
pine tek tek dokunmak zorunda. Web haritası pine günlük fiyatı (`₺80`), talep testi
noktasına "Yakında" yazıyor.

## What Changes

- Mobil harita pini web ile aynı bilgiyi taşır: günlük fiyat hapı; talep testi noktasında
  fiyat yerine "Yakında" (oradaki fiyat gerçek değil).
- Seçili pin koyu zeminle ayrışır; ekran okuyucu pini "ad, fiyat / gün" olarak okur.
- Yakın pinlerin kümelenmesi bu değişikliğin dışında (ayrı iş).

## Capabilities

### New Capabilities
- `mobile-search-map`: Mobil arama haritasında dükkan pinlerinin gösterdiği bilgi

### Modified Capabilities

## Impact

- **Mobile**: `mobile-expo/src/app/(guest)/map.tsx`; sunucu değişmez (`pricePerDay`,
  `isPrelaunch` yanıtta zaten var)
