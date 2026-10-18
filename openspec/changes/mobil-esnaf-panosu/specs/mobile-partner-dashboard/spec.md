## Purpose

Esnafın mobil uygulamada, web paneliyle aynı rakamlarla gördüğü günlük dükkan özetini
(gelecek, alınacak, elde duran valiz ve aylık kazanç) tanımlar.

## ADDED Requirements

### Requirement: Özet web paneliyle aynı rakamları verir
Mobil özet, web esnaf panelinin günlük durum bloğuyla aynı dükkan ve aynı tanımlarla
hesaplanmalıdır (MUST); mobil uç kendi sayım kuralını yazmamalıdır.

#### Scenario: Aynı dükkan, aynı sayılar
- **WHEN** esnaf aynı anda web panelini ve mobil ana ekranı açar
- **THEN** bugün gelecek, bugün alınacak, elde duran valiz ve bu ay kazanç ikisinde aynıdır

#### Scenario: Çok dükkanlı esnaf
- **WHEN** esnafın birden fazla dükkanı vardır ve dükkan belirtilmemiştir
- **THEN** web panelinin varsayılan olarak seçtiği dükkanın özeti döner

### Requirement: Yalnızca esnaf erişir
Özet yalnızca oturum açmış PARTNER rolündeki kullanıcıya kendi dükkanı için dönmelidir (MUST).

#### Scenario: Misafir
- **WHEN** GUEST rolündeki kullanıcı özeti ister
- **THEN** 403 döner

#### Scenario: Dükkanı yok
- **WHEN** esnafın hiç dükkanı yoktur
- **THEN** `no_shops` koduyla 404 döner

### Requirement: Aylık değişim yanıltmaz
Geçen ay kazanç sıfırsa yüzde değişim gösterilmemelidir (MUST); "%∞" ya da "%0" yazılmaz.

#### Scenario: Geçen ay sıfır
- **WHEN** geçen ayın esnaf payı 0'dır
- **THEN** kart yalnızca bu ayın tutarını gösterir, değişim satırı yoktur

### Requirement: Özet listeyi engellemez
Özet yüklenemezse rezervasyon listesi yine kullanılabilir olmalıdır (MUST).

#### Scenario: Özet ucu hata verir
- **WHEN** özet isteği başarısız olur
- **THEN** kart yerine kısa bir hata satırı görünür, rezervasyon listesi çalışır
