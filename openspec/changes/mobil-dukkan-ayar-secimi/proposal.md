## Why

Mobil dükkan ayarı uçları — `partner/shop` (bilgiler, PUT), `partner/shop/schedule`
(haftalık saat ve izin günleri), `partner/shop/image` (vitrin fotoğrafı) — dükkanı
`shopService.getShopByOwner` ile seçiyor: sıralamasız `findFirst({ ownerId })`. Bunlar
**yazma** uçları; çok dükkanlı esnafın fiyat, kapasite, saat ya da fotoğraf değişikliği
veritabanının o anki plan seçimine göre rastgele bir dükkana yazılabilir. Web paneli ve
mobil mühür uçları `resolvePartnerShops(?shop=)` kullanıyor.

## What Changes

- `ShopService.getShopByOwner(ownerId, requestedShopId?)` web ile aynı seçimi yapar
  (`resolvePartnerShops`): istenen dükkan esnafınsa o, değilse deterministik varsayılan.
- Üç uç `?shop=` sorgu parametresini iletir.
- Expo: dükkan bilgileri, çalışma saatleri ve fotoğraf ekranları esnaf ekranlarının ortak
  dükkan seçimini (`lib/partner-shop.tsx`) kullanır ve hangi dükkanı düzenlediğini gösterir.

## Capabilities

### New Capabilities
- `mobile-partner-shop-settings`: Esnafın mobilde dükkan bilgisi, çalışma saati ve fotoğraf düzenlemesinin hangi dükkana yazıldığı

### Modified Capabilities

## Impact

- **Servis**: `src/services/ShopService.ts` (`getShopByOwner`)
- **API**: `src/app/api/mobile/partner/shop/{route,schedule/route,image/route}.ts`
- **Test**: `src/__tests__/shop-by-owner.test.ts`, mevcut `mobile-partner-shop-image.test.ts`
- **Mobile**: `mobile-expo/src/lib/queries.ts`, `(partner)/partner/{shop,settings,schedule}.tsx`
