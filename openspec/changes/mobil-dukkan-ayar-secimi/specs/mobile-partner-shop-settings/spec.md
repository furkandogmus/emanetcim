## Purpose

Esnafın mobilde yaptığı dükkan bilgisi, çalışma saati ve vitrin fotoğrafı değişikliğinin
hangi dükkana yazılacağını web paneliyle aynı kuralla belirler.

## ADDED Requirements

### Requirement: Ayar değişikliği belirli ve doğru dükkana yazılır
Mobil dükkan ayarı okuma ve yazma işlemleri, web paneliyle aynı dükkan seçim kuralını
kullanmalıdır (MUST); seçim veritabanı sırasına bırakılmamalıdır.

#### Scenario: Seçili dükkan
- **WHEN** çok dükkanlı esnaf mobilde Galata dükkanını seçip fiyatı değiştirir
- **THEN** yalnızca Galata'nın fiyatı değişir

#### Scenario: Dükkan belirtilmeden
- **WHEN** istek dükkan belirtmez
- **THEN** her seferinde aynı (web panelinin varsayılanı olan) dükkan okunur ve yazılır

#### Scenario: Başkasının dükkanı
- **WHEN** esnaf sahibi olmadığı bir dükkan kimliği gönderir
- **THEN** o dükkana yazılmaz; esnafın varsayılan dükkanı kullanılır

### Requirement: Ekran hangi dükkanı düzenlediğini gösterir
Çok dükkanlı esnafta dükkan bilgisi, çalışma saati ve fotoğraf ekranları düzenlenen
dükkanın adını göstermelidir (MUST).

#### Scenario: Ortak seçim
- **WHEN** esnaf ana ekranda bir dükkan seçip ayarlara geçer
- **THEN** ayar ekranları o dükkanın verisini ve adını gösterir
