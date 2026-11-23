## Context

Web `/partner` sayfası `resolvePartnerShops` ile aktif dükkanı seçer, dükkanın
`timezone`'unu okur ve `partnerDashboardService.getSnapshot(shopId, timezone, rate)`
çağırır. Mobil esnaf ana ekranı `partner/index.tsx`; React Query ile `partner/bookings`.

## Goals / Non-Goals

**Goals:** web ile aynı servis, aynı dükkan seçimi; listeyi bozmadan üstte kart.

**Non-Goals:** mobilde dükkan değiştirici (çok dükkanlı esnaf için ayrı iş: mühür uçları
da `findFirst` kullanıyor, aynı değişiklikte düzeltilecek); dükkan görüntülenme sayısı.

## Decisions

- **Dükkan seçimi `?shop=` sorgu parametresiyle, yoksa `resolvePartnerShops` varsayılanı** —
  web ile aynı kural. Alternatif (ilk aktif dükkan) web'den ayrışırdı.
- **Kart ayrı sorgu** (`["partner","dashboard"]`): listeden bağımsız yüklenir ve hata verir;
  `keys.partner*` önekiyle check-in/out sonrası geçersiz kılınan `["partner"]` ailesine girer,
  böylece teslim alındığında sayılar yenilenir.
- **Para** `moneyToNumber` değil: servis zaten `number` döndürüyor; DTO yine de alanları
  tek tek eşler (`mobile-dto` mandalı).

## Risks / Trade-offs

- [Servis ağır sorgu] → yalnızca ana ekranda, `staleTime` 30 sn (uygulama varsayılanı).
