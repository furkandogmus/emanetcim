## Purpose

Mobil admin uygulamasında destek mesajlarına e-postayla cevap verilmesini tanımlar.

## ADDED Requirements

### Requirement: Cevap web paneliyle aynı kuralla gider
Mobil cevap, web panelindeki cevapla aynı servisten geçmelidir (MUST): misafirin adresine,
yazdığı destek adresinden, sadeleştirilmiş "Re:" konusuyla gider.

#### Scenario: Başarılı cevap
- **WHEN** admin açık bir mesaja en az 2 karakterlik bir cevap yazıp gönderir
- **THEN** e-posta gönderilir, `ContactReply` kaydı yazılır, mesaj okundu olur ve ekranda "Cevap e-postayla gönderildi." görünür

#### Scenario: E-posta gönderilemedi
- **WHEN** e-posta sağlayıcısı gönderimi reddeder ya da yapılandırılmamıştır
- **THEN** uç 502 `email_send_failed` döner, kayıt yazılmaz, ekranda çevrilmiş hata görünür ve yazılan metin silinmez

### Requirement: Yalnızca admin cevap verebilir
Uç yalnızca ADMIN rolüne açık olmalıdır (MUST).

#### Scenario: Esnaf dener
- **WHEN** PARTNER rolündeki kullanıcı uca istek atar
- **THEN** 403 döner ve e-posta gönderilmez
