## Why

Mobil mühür uçları (`partner/seals`, `seals/request`, `seals/report-faulty`) esnafın
dükkanını `findFirst({ ownerId, isActive })` ile, sıralama vermeden seçiyor. Çok dükkanlı
esnafta stok rastgele bir dükkandan okunuyor, talep o dükkana açılıyor; diğer dükkandaki
arızalı mühür "bulunamadı" dönüyor. Web mühür sayfası ise `resolvePartnerShops(?shop=)`
kullanıyor. 2026-10-18 e2e verisinde esnafın üç dükkanı var.

## What Changes

- Üç uç da web ile aynı seçimi kullanır: `resolvePartnerShops(userId, ?shop=)`.
- `GET partner/seals` yanıtı özetin ait olduğu dükkanı (`shop`) taşır.
- Expo: esnafın seçtiği dükkan esnaf ekranları arasında paylaşılır (ana ekran özet kartı ve
  mühür ekranı); mühür ekranı dükkan adını gösterir ve her isteğe `?shop=` ekler.

## Capabilities

### New Capabilities
- `mobile-partner-seals`: Esnafın mobilde mühür stoğunu görmesi, talep açması ve arızalı bildirmesi

### Modified Capabilities

## Impact

- **API**: `src/app/api/mobile/partner/seals/{route,request/route,report-faulty/route}.ts`
- **Test**: `src/__tests__/mobile-partner-seals-shop.test.ts`
- **Mobile**: `mobile-expo/src/lib/partner-shop.tsx` (paylaşılan seçim), `queries.ts`,
  `PartnerPulseCard.tsx`, `(partner)/_layout.tsx`, `(partner)/partner/{index,seals}.tsx`
- Davranış farkı: web kuralı onay bekleyen (pasif) dükkanı da sayar; mobil artık aynısını yapar.
