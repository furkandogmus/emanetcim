## ADDED Requirements

### Requirement: Dükkan bilgisi web ile eşit
Dükkan ekranı web dükkan sayfasıyla aynı karar bilgisini vermelidir (SHALL): çalışma
saatleri, haftalık saatler, valiz boyuna göre günlük fiyat (S/M/XL, `pricing`
çarpanlarından), yorumlar. Adres, içinde zaten geçen ilçe/şehri tekrarlamaz.

#### Scenario: Boy boy fiyat
- **WHEN** misafir dükkan ekranını açar
- **THEN** her valiz boyu için `pricePerDay × çarpan` "/ gün" olarak listelenir

#### Scenario: Yorum yüklenemedi
- **WHEN** `shops/[id]/reviews` hata verir
- **THEN** yorum bölümü gizlenir, ekranın geri kalanı çalışır

### Requirement: Anında onaylı rezervasyon
Rezervasyon oluşturulduğu anda `APPROVED` olmalıdır (SHALL); esnaf onay adımı yoktur.
Ödeme dükkanda alınır; istemcideki tutar tahmindir, kesin tutarı sunucu hesaplar.

#### Scenario: Başarılı rezervasyon
- **WHEN** misafir onay ekranında "Rezervasyonu onayla"ya basar
- **THEN** başarı ekranı açılır; rezervasyon detayında durum "Onaylandı" ve QR görünür

#### Scenario: Test ya da talep testi dükkanı
- **WHEN** dükkan `isTest` ya da `isPrelaunch` ise
- **THEN** sunucu `shop_not_found` döner, rezervasyon oluşmaz

### Requirement: Rezervasyon detayı
Misafir detayı QR kodu, rezervasyon kodunu (kimliğin ilk 8 hanesi, büyük harf; web'deki
kodla aynı), tarihleri, valizleri ve toplamı göstermelidir (SHALL). Yol tarifi yalnızca
aktif rezervasyonda gösterilir.

#### Scenario: QR okunamıyor
- **WHEN** esnaf QR'ı okutamaz
- **THEN** misafir ekrandaki 8 haneli kodu söyleyebilir; esnaf detayında aynı kod görünür

### Requirement: İptal
Misafir valizi dükkana teslim edilmemiş rezervasyonu (PENDING, WAITING_APPROVAL,
APPROVED, PAID) onay penceresinden sonra iptal edebilmelidir (SHALL).

#### Scenario: Dükkanda ödeme modunda iptal
- **WHEN** ödeme alınmamış rezervasyon iptal edilir
- **THEN** "Senden herhangi bir ücret alınmadı" gösterilir, durum "İptal edildi" olur
