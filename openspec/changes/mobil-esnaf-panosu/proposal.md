## Why

Web esnaf paneli dükkan açılırken sorulan soruları yanıtlıyor: bugün kaç valiz gelecek,
kaçı alınacak, elde kaç valiz var, bu ay kazanç geçen aya göre nasıl
(`partnerDashboardService.getSnapshot`). Mobil esnaf ana ekranı yalnızca rezervasyon
listesi; bu özet mobilde hiç yok. Esnafın günlük işini telefondan yürütmesi beklenen
yüzey bu.

## What Changes

- Yeni mobil uç `GET /api/mobile/partner/dashboard`: web paneliyle **aynı** servis
  (`partnerDashboardService.getSnapshot`) ve aynı dükkan seçimi (`resolvePartnerShops`),
  komisyon `getEffectiveCommission`'dan; yanıt `mobile-dto.ts` DTO'su.
- Expo esnaf ana ekranının üstünde günlük özet kartı: bugün gelecek / alınacak, elde duran
  valiz, bu ayın kazancı ve geçen aya göre değişim. Kart yenilemeyle güncellenir; hata
  listeyi engellemez.

## Capabilities

### New Capabilities
- `mobile-partner-dashboard`: Esnafın mobil ana ekranındaki günlük dükkan özeti

### Modified Capabilities

## Impact

- **API**: `src/app/api/mobile/partner/dashboard/route.ts`, `src/lib/mobile-dto.ts`
- **Test**: `src/__tests__/mobile-partner-dashboard.test.ts`
- **Mobile**: `mobile-expo/src/lib/{types,queries}.ts`, `mobile-expo/src/components/PartnerPulseCard.tsx`,
  `mobile-expo/src/app/(partner)/partner/index.tsx`, locale dosyaları
- İş kuralı yeni yazılmaz; servis değişmez.
