## 1. Giriş

- [x] 1.1 E-posta + şifre girişi; `invalid_credentials` çevirisi
- [x] 1.2 Ağ hatası / 5xx'te oturumu koru, yalnızca 401/403'te kapat
- [x] 1.3 Prod doğrulama: maestro-guest ve maestro-partner ile giriş (2026-10-18)

## 2. Arama penceresi

- [x] 2.1 `lib/time.ts`: İstanbul duvar saati yardımcıları
- [x] 2.2 Saat seçici, takvim "bugün"ü, varsayılan pencere, biçimlendirme İstanbul saatiyle
- [x] 2.3 Prod doğrulama: telefon Europe/London'da, 09:00 → `06:00Z` (2026-10-18)
- [x] 2.4 Bayat pencereyi açılışta ve ön plana dönüşte ilerlet
- [x] 2.5 30 × 24 saat sınırı
- [x] 2.6 `shops/nearby`'ye `stayDays` (PR #54, prod'da)

## 3. Rezervasyon

- [x] 3.1 Dükkan ekranında boy boy fiyat ve yorumlar; adres tekrarı
- [x] 3.2 Rezervasyon kodu; biten rezervasyonda yol tarifi gizli
- [x] 3.3 Prod doğrulama: oluştur (`740e72c4`), iptal (`1a043d1a`), web'de aynı kod/tutar

## 4. Esnaf teslimi

- [x] 4.1 Teslim al: isteğe bağlı mühür, hata kodları çevrildi
- [x] 4.2 Teslim et: mühür sağlamlık onayı
- [x] 4.3 Gelmeyen misafir "Geçmiş"e
- [x] 4.4 Prod doğrulama: dükkan kapalıyken `SHOP_CLOSED` mesajı (2026-10-18 03:01 TRT)
- [ ] 4.5 Prod doğrulama: başarılı teslim al ve teslim et (dükkan 08:00 TRT'de açılınca, `740e72c4`)

## 5. Yayın

- [x] 5.1 Expo CI: typecheck + dil paritesi (PR #55)
- [x] 5.2 EAS production build 11 (`5dc52da4`) → Play dahili test, completed (2026-10-18)
- [ ] 5.3 Production izi: geliştirici hesabı türüne göre kapalı test şartı (12 kişi / 14 gün) netleşecek
