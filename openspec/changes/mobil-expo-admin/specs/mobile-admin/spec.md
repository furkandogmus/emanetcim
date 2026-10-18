## ADDED Requirements

### Requirement: Admin yönlendirmesi
ADMIN rolündeki kullanıcı girişte admin paneline yönlenmelidir (SHALL); misafir ve esnaf
ekranları admin grubunda gösterilmez. Uçlar rolü sunucuda ayrıca denetler.

#### Scenario: Admin girişi
- **WHEN** ADMIN rolündeki kullanıcı giriş yapar
- **THEN** admin panosu açılır

#### Scenario: Yetkisiz çağrı
- **WHEN** misafir ya da esnaf token'ıyla bir `admin/*` ucu çağrılır
- **THEN** sunucu 403 döner

### Requirement: Admin panosu
Pano toplam rezervasyon, ciro (`EARNING_BOOKING_STATUSES` toplamı), dükkan sayısı, bekleyen
başvuru ve okunmamış mesaj sayısını göstermelidir (SHALL); değerler web admin panosuyla aynı
kaynaktan gelir.

#### Scenario: Bekleyen başvuruya geçiş
- **WHEN** admin "Bekleyen başvuru" sayısına dokunur
- **THEN** başvurular ekranı açılır

### Requirement: Esnaf başvurusunu onaylama
Admin pasif dükkanı onaylayabilmelidir (SHALL). Onay web `approveShopAction` ile aynı
denetim kaydını (`shop.approve_application`) yazar.

#### Scenario: Konumsuz başvuru
- **WHEN** dükkanın koordinatı yoktur
- **THEN** sunucu 409 `missing_coordinates` döner, uygulama "Önce dükkanın konumunu girin" der

### Requirement: Esnaf başvurusunu reddetme
Reddetme dükkanı siler; yıkıcı onay penceresinden sonra yapılmalı (SHALL) ve
`shop.reject_application` denetim kaydını, serbest kalan mühür sayısıyla yazmalıdır (SHALL).

#### Scenario: Aktif rezervasyonlu dükkan
- **WHEN** dükkanın APPROVED, PAID ya da CHECKED_IN rezervasyonu vardır
- **THEN** sunucu 409 `has_active_bookings` döner, dükkan silinmez

### Requirement: İletişim mesajları
Admin mesajları listeleyip okundu işaretleyebilmeli ve silebilmelidir (SHALL). Silme yıkıcı
onay ister. E-postayla cevap yalnızca web'dedir.

#### Scenario: Olmayan mesaj
- **WHEN** silinmiş bir mesaj için PATCH ya da DELETE gelir
- **THEN** sunucu 404 `not_found` döner, 500 değil

### Requirement: Mobil yanıt gövdeleri
Başvuru listesi `mobile-dto.ts`'teki DTO ile dönmelidir (SHALL): para `number`, yalnızca
ekranın kullandığı alanlar; ham Prisma kaydı dönmez.

#### Scenario: Fiyat tipi
- **WHEN** başvuru listesi istenir
- **THEN** `pricePerDay` sayıdır (`moneyToNumber`), string değil
