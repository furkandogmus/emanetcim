## ADDED Requirements

### Requirement: Valizi teslim alma
Esnaf APPROVED ya da PAID rezervasyonda valizleri teslim alabilmelidir (SHALL). Her valiz
için mühür numarası isteğe bağlıdır; girilirse bütün valizler için girilir. Sıralama
`BookingSeal.bagIndex` ile aynıdır: önce S, sonra M, sonra XL (web `CheckInDialog`).

#### Scenario: Mühürsüz teslim
- **WHEN** platform ayarı `requireSealsOnCheckIn` kapalıyken esnaf mühür girmeden "Teslim aldım"a basar
- **THEN** rezervasyon CHECKED_IN olur

#### Scenario: Eksik mühür
- **WHEN** üç valizden yalnızca birinin mührü girilir
- **THEN** "Ya bütün valizlerin mührünü gir ya da hiçbirini" uyarısı görünür, düğme kapalıdır

#### Scenario: Dükkan kapalı
- **WHEN** esnaf çalışma saatleri dışında teslim almaya çalışır
- **THEN** sunucu `SHOP_CLOSED` döner ve çevrilmiş mesaj gösterilir

#### Scenario: Sunucu mühür istiyor
- **WHEN** sunucu `SEAL_REQUIRED` ya da `SEAL_COUNT_MISMATCH` döner
- **THEN** çevrilmiş mesaj gösterilir; kural istemcide tekrar yazılmaz

### Requirement: Valizi geri verme
Esnaf CHECKED_IN rezervasyonda valizleri geri verebilmelidir (SHALL). Check-in'de
kaydedilen her mühür "sağlam" işaretlenmeden onay açılmaz (web `CheckoutSealsDialog`).

#### Scenario: Mühürlü geri verme
- **WHEN** iki mühürlü rezervasyonda yalnızca biri işaretlidir
- **THEN** "Teslim ettim" kapalıdır; ikisi de işaretlenince açılır ve durum CHECKED_OUT olur

### Requirement: Esnaf listesi
Esnaf listesi Bugün / Yaklaşan / Geçmiş sekmelerine İstanbul gününe göre ayrılmalıdır
(SHALL). Valiz dükkandaysa (CHECKED_IN) kayıt her zaman "Bugün"dedir; alma saati geçmiş
ve hiç teslim alınmamış kayıt "Geçmiş"e düşer.

#### Scenario: Gelmeyen misafir
- **WHEN** APPROVED bir rezervasyonun alma saati geçmiştir
- **THEN** kayıt "Bugün"de değil "Geçmiş"te görünür
