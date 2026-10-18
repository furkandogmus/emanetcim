## Purpose

Expo mobil uygulamasının main'e girmeden önce geçmesi gereken otomatik kapıyı ve bu
kapının regresyona karşı koruduğu oturum, hata ve fiyat davranışlarını tanımlar.

## ADDED Requirements

### Requirement: Kapı kaynak kodun tamamını denetler
Expo kapısı `src/` altındaki her TypeScript dosyasını lint ve tip denetiminden
geçirmeli; hiçbir kaynak dosya yapılandırma eksikliği yüzünden sessizce atlanmamalıdır.

#### Scenario: Lint kaynak dosyaları tarar
- **WHEN** `mobile-expo` içinde lint çalıştırılır
- **THEN** `src/` altındaki dosyalar denetlenir ve "all files are ignored" uyarısı çıkmaz

#### Scenario: Kırık kod kapıyı düşürür
- **WHEN** bir değişiklik lint hatası, tip hatası, başarısız test ya da eksik çeviri anahtarı içerir
- **THEN** `npm run verify` sıfırdan farklı kodla çıkar ve Mobile Expo CI kırmızı olur

### Requirement: Token yenileme tek uçuşta kalır
Aynı anda 401 alan istekler sunucuya en fazla bir yenileme isteği göndermelidir;
sunucu refresh token tekrarını tüm oturum ailesini iptal ederek cezalandırır.

#### Scenario: Eşzamanlı iki 401
- **WHEN** iki istek aynı anda 401 alır ve geçerli bir refresh token vardır
- **THEN** yalnızca bir `auth/refresh` isteği gider ve iki istek de yeni token ile yeniden denenir

#### Scenario: Yenileme reddedilir
- **WHEN** `auth/refresh` başarısız döner
- **THEN** saklanan token'lar silinir, oturum-düştü işleyicisi bir kez çağrılır ve istek `session_expired` koduyla hata verir

### Requirement: Kullanıcıya ham sunucu hatası gösterilmez
Sunucu hata kodu, ekranın ad alanında çevirisi varsa o çeviriye, ağ hatası ağ
mesajına, bilinmeyen her şey genel hata mesajına dönüşmelidir.

#### Scenario: Bilinen kod
- **WHEN** sunucu `insufficient_capacity` döner ve ilgili ad alanında çevirisi vardır
- **THEN** kullanıcı o çeviriyi görür

#### Scenario: Bilinmeyen kod veya ham hata
- **WHEN** çevirisi olmayan bir kod ya da `ApiError` olmayan bir hata gelir
- **THEN** kullanıcı genel hata mesajını görür, ham metni görmez

### Requirement: Fiyat tahmini sunucu fiyatlandırmasını izler
İstemci fiyat tahmini yalnızca dükkan yanıtındaki fiyat ve çarpanlardan hesaplanmalı,
valiz boyu ve gün sayısıyla tutarlı büyümelidir.

#### Scenario: Valiz ve gün etkisi
- **WHEN** valiz sayısı ya da gün sayısı artar
- **THEN** tahmin azalmaz ve sıfır valizde sıfırdır
