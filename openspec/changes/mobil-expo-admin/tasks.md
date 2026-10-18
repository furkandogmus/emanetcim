## 1. Sunucu

- [x] 1.1 Onay/red gövdesini (servis + `writeAuditLog`) tek fonksiyona al; web action ve mobil uç ondan çağırsın
- [x] 1.2 `admin/applications/[id]/[action]`: hata kodları (`not_found`, `missing_coordinates`, `has_active_bookings`, `invalid_action`)
- [x] 1.3 `admin/applications` GET: `toMobileAdminApplication` DTO (`mobile-dto.ts`)
- [x] 1.4 `admin/messages/[id]` PATCH/DELETE: olmayan kayıtta 404
- [x] 1.5 Testler: denetim kaydı yazılıyor, kodlar, 404, 403 (misafir/esnaf)

## 2. Expo

- [x] 2.1 `_layout.tsx`: ADMIN → `(admin)` grubu
- [x] 2.2 Pano (`admin/stats`), sayılardan ilgili ekrana geçiş
- [x] 2.3 Başvurular: liste, onayla, reddet (yıkıcı onay), `admin.errors.*` çevirileri
- [x] 2.4 Mesajlar: liste, okundu, sil (yıkıcı onay)
- [x] 2.5 tr/en anahtarları; `npm run verify`

## 3. Doğrulama

- [x] 3.1 Emülatörde prod'a karşı `maestro-admin` ile pano ve mesajlar (2026-10-18; sayılar web panosuyla aynı)
- [ ] 3.2 Test hesabına ait bir başvuruyla onay ve red; denetim kaydında iki satır
- [ ] 3.3 Web admin panelinde aynı sonuç (`expo-web-to-native` karşılaştırması)
