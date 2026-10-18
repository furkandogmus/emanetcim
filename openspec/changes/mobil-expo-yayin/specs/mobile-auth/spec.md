## ADDED Requirements

### Requirement: E-posta koduyla giriş
Uygulama e-postaya 6 haneli kod göndererek giriş yaptırmalıdır (SHALL). İlk girişte
hesap sunucuda açılır (`/auth/session`); ayrı kayıt ekranı yoktur.

#### Scenario: Yeni e-posta
- **WHEN** daha önce hesabı olmayan bir e-posta kodu doğru girer
- **THEN** misafir hesabı açılır ve kullanıcı ana ekrana geçer

#### Scenario: Hatalı kod
- **WHEN** sunucu `invalid_code` döner
- **THEN** ekranda çevrilmiş "Kod hatalı ya da süresi dolmuş" mesajı görünür, ham metin gösterilmez

### Requirement: E-posta ve şifreyle giriş
Uygulama, web'de şifre belirlemiş kullanıcılar ve Play inceleme hesabı için e-posta +
şifre ile girişi sunmalıdır (SHALL). Kod girişi varsayılan kalır.

#### Scenario: Doğru şifre
- **WHEN** kullanıcı "Şifreyle giriş yap"ı seçip doğru e-posta ve şifreyi girer
- **THEN** rolüne göre misafir ya da esnaf ekranına yönlenir

#### Scenario: Yanlış şifre
- **WHEN** sunucu `invalid_credentials` döner
- **THEN** "E-posta ya da şifre hatalı" gösterilir

### Requirement: Oturumun korunması
Oturum yalnızca sunucu oturumu geçersiz saydığında kapanmalıdır (SHALL): 401 (yenileme
de başarısızsa) ya da 403. Token'lar ve son bilinen kullanıcı SecureStore'da tutulur.

#### Scenario: Çevrimdışı açılış
- **WHEN** uygulama açılırken `/auth/me` ağ hatası ya da 5xx verir ve kayıtlı kullanıcı vardır
- **THEN** kullanıcı kayıtlı kimlikle içeride kalır, giriş ekranına atılmaz

#### Scenario: Geçersiz oturum
- **WHEN** `/auth/me` 401 döner ve refresh token da reddedilir
- **THEN** token'lar ve kayıtlı kullanıcı silinir, giriş ekranı açılır

### Requirement: Tek uçuşta token yenileme
Aynı anda 401 alan istekler refresh token'ı tek bir istekle yenilemelidir (SHALL);
sunucu refresh token tekrarını oturum ailesini iptal ederek cezalandırır.

#### Scenario: Eşzamanlı 401
- **WHEN** iki istek aynı anda 401 alır
- **THEN** yalnızca bir `/auth/refresh` isteği gider, ikisi de yeni token'la tekrarlanır
