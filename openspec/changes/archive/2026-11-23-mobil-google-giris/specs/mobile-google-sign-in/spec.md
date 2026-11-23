## Purpose

Mobil uygulamada Google hesabıyla girişin kullanıcıya nasıl sunulduğunu ve sunucunun
Google kimlik token'ını hangi koşullarda kabul ettiğini tanımlar.

## ADDED Requirements

### Requirement: Android'de Google ile giriş sunulur
Android uygulaması, web istemci kimliği yapılandırılmışsa giriş ekranında Google ile
giriş seçeneği göstermelidir (MUST); seçilen hesabın kimlik token'ı sunucuda doğrulanınca
kullanıcı diğer giriş yollarıyla aynı oturumu alır.

#### Scenario: Başarılı giriş
- **WHEN** kullanıcı "Google ile devam et"e dokunup bir Google hesabı seçer
- **THEN** sunucu token'ı doğrular, kullanıcı rolüne uygun ana ekrana geçer

#### Scenario: Kullanıcı vazgeçer
- **WHEN** kullanıcı hesap seçiciyi kapatır
- **THEN** hata gösterilmez, giriş ekranında kalınır

#### Scenario: Yapılandırma yok
- **WHEN** uygulama web istemci kimliği olmadan derlenmiştir
- **THEN** Google düğmesi gösterilmez

#### Scenario: Sunucu reddeder
- **WHEN** sunucu token'ı reddeder ya da hesap engellidir
- **THEN** kullanıcı çevrilmiş bir hata mesajı görür, ham metin görmez

### Requirement: Sunucu yalnızca tanımlı istemcilerin token'ını kabul eder
Sunucu Google kimlik token'ını yalnızca yapılandırılmış istemci kimliklerinden biri
hedef kitle (audience) ise kabul etmelidir (MUST); hiçbir istemci kimliği
yapılandırılmamışsa token'ı doğrulamadan reddetmelidir.

#### Scenario: Kimlik yapılandırılmamış
- **WHEN** sunucuda hiçbir Google istemci kimliği tanımlı değildir
- **THEN** uç `503 google_not_configured` döner ve kullanıcı oluşturulmaz
