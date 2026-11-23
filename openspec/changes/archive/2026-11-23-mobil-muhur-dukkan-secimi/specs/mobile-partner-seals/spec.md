## Purpose

Esnafın mobilde mühür stoğunu görmesi, talep açması ve arızalı bildirmesinin hangi dükkan
için yapıldığını web ile aynı kuralla belirler.

## ADDED Requirements

### Requirement: Mühür işlemleri web ile aynı dükkanı seçer
Mobil mühür stoku, talep ve arızalı bildirimi, web mühür sayfasıyla aynı dükkan seçim
kuralını kullanmalıdır (MUST): istenen dükkan esnafın ise o, değilse web'in varsayılanı.

#### Scenario: Dükkan belirtilmeden
- **WHEN** çok dükkanlı esnaf mühür stoğunu dükkan belirtmeden ister
- **THEN** web mühür sayfasının varsayılan dükkanının stoğu döner, yanıt hangi dükkan olduğunu söyler

#### Scenario: Belirli dükkan
- **WHEN** esnaf kendi ikinci dükkanı için talep açar
- **THEN** talep o dükkana açılır

#### Scenario: Başkasının dükkanı
- **WHEN** esnaf sahibi olmadığı bir dükkan kimliği gönderir
- **THEN** istek o dükkana uygulanmaz; esnafın varsayılan dükkanı kullanılır

### Requirement: Stok ve talep aynı dükkandan
Mobil ekranda görünen stok ile açılan talep ve arızalı bildirimi aynı dükkana ait olmalıdır (MUST).

#### Scenario: Ekrandaki dükkan
- **WHEN** esnaf ana ekranda bir dükkanı seçip mühür ekranına geçer
- **THEN** mühür ekranı o dükkanın adını ve stoğunu gösterir, talep o dükkana açılır
