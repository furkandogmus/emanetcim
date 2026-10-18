## ADDED Requirements

### Requirement: Platform saatiyle duvar saati
Bırakma/alma saatleri, takvimin "bugün"ü ve ekrandaki bütün tarih-saatler platform
saatiyle (Europe/Istanbul, sabit +03:00) kurulmalı ve gösterilmelidir (SHALL);
telefonun saat dilimi kullanılmaz. Sunucu açılış saatlerini ve günleri bu saatle ölçer
(`src/lib/datetime-local.ts` → `PLATFORM_TIMEZONE`).

#### Scenario: Yurt dışı saat diliminde telefon
- **WHEN** telefon Europe/London'dayken misafir 22 Eki 09:00 bırakma seçer
- **THEN** sunucuya `2026-10-22T06:00:00Z` (09:00 TRT) gider ve rezervasyon her yerde 09:00 görünür

#### Scenario: Gece yarısı farkı
- **WHEN** telefonun yerel tarihi İstanbul tarihinden farklıdır
- **THEN** takvimde "bugün" İstanbul günüdür; geçmiş günler İstanbul'a göre kapalıdır

### Requirement: Varsayılan pencere
İlk açılışta pencere bir sonraki tam saatten başlayıp 4 saat sürmelidir (SHALL); bu
saat 08:00'den önce ya da 18:00'den sonraysa bırakma bir sonraki uygun günün 09:00'ı olur.

#### Scenario: Gece açılış
- **WHEN** uygulama İstanbul saatiyle 03:10'da açılır
- **THEN** pencere aynı gün 09:00–13:00 olur

### Requirement: Bayat pencerenin ilerletilmesi
Bırakma saati geçmişte kalan pencere, uygulama açılırken ve ön plana dönerken
varsayılan pencereye kaydırılmalıdır (SHALL); valiz sayıları korunur.

#### Scenario: Arka planda saat geçti
- **WHEN** uygulama arka plandayken bırakma saati geçer ve kullanıcı haritaya döner
- **THEN** harita `invalid_dates` almaz; yeni pencereyle sonuç gelir

### Requirement: Kalış sınırı
Bırakma ile alma arası en az 1 saat, en fazla 30 × 24 saat olmalıdır (SHALL). Sunucu
gün sayısını yukarı yuvarladığı için takvimde 30 gün seçilse bile alma saati bırakma
saatini geçemez.

#### Scenario: 30. gün geç saat
- **WHEN** 30 günlük aralıkta alma saati bırakmadan geç seçilmeye çalışılır
- **THEN** o saatler seçilemez ve "Devam" kapalı kalır

### Requirement: Arama sonucunda gün kapısı
Tarihli yakın dükkan araması haftalık takvimde kapalı ya da o tarihte izinli dükkanı
listelememelidir (SHALL); web aramasıyla aynı `stayDays` kapısı.

#### Scenario: Pazar kapalı dükkan
- **WHEN** misafir pazar günü için arar ve dükkan pazar kapalıdır
- **THEN** dükkan haritada çıkmaz (ödeme adımında `shop_closed_on_date` beklenmez)
