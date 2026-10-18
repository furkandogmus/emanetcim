## Purpose

Mobil arama haritasındaki dükkan pinlerinin misafire hangi bilgiyi gösterdiğini tanımlar.

## ADDED Requirements

### Requirement: Pin günlük fiyatı gösterir
Haritadaki her rezervasyon alan dükkan pini, valiz başı günlük fiyatı göstermelidir (MUST).

#### Scenario: Normal dükkan
- **WHEN** harita fiyatı 80 TL olan bir dükkanı gösterir
- **THEN** pinin üzerinde `₺80` yazar

#### Scenario: Talep testi noktası
- **WHEN** dükkan talep testi noktasıdır (rezervasyon almaz)
- **THEN** pinde fiyat yerine "Yakında" yazar

### Requirement: Pin erişilebilir ve seçimi belli
Pin ekran okuyucuya dükkan adını ve fiyatını okutmalı (MUST), seçili pin diğerlerinden
görsel olarak ayrışmalıdır (MUST).

#### Scenario: Seçili pin
- **WHEN** misafir bir pine dokunur
- **THEN** o pin koyu zeminle gösterilir, diğerleri marka renginde kalır
