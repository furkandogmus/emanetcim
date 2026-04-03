# Emanetçi: Senaryolar ve İş Kuralları Matrisi

Bu doküman, sistemin her türlü operasyonel duruma (en iyi, normal ve en kötü) vereceği tepkileri ve kurumsal iş kurallarını (business rules) detaylandırır.

---

## 🟢 1. En İyi Senaryolar (Best Cases)

### Vaka 1.1: Standart Kusursuz Rezervasyon
- **Durum:** Misafir rezervasyon yapar, vaktinde gelir, valizi mühürlenir, vaktinde alır ve esnafa 5 yıldız verir.
- **Kural:** Standart operasyon akışı işletilir. Esnaf hakedişi aynı gün havuz hesabına geçer.

### Vaka 1.2: Çapraz Satış Başarısı
- **Durum:** Misafir valizi bırakırken dükkandan 3 adet hediyelik eşya/su satın alır.
- **Kural:** Esnaf, sistem üzerinden misafire dükkan içi %10 indirim kuponu tanımlamış olduğu için satış daha kolay gerçekleşir. Eksrta kâr %100 esnafta kalır.

---

## 🟡 2. Normal / Beklenen İstisnalar (Average Cases)

### Vaka 2.1: Gecikmeli Teslim Alım (Geç Kalma)
- **Durum:** Misafir valizini 18:00'de alacağını belirtti ancak trafikten dolayı 18:45'te geldi.
- **Kural:** İlk 15 dakika tolerans tanınır. 15 dakikadan sonraki her tam saat için ek ücret (Örn: 20 TL) sistem tarafından otomatik tahsil edilir.

### Vaka 2.2: Yanlış Boyut Seçimi
- **Durum:** Misafir uygulamada S (Sırt Çantası) seçti ama kapıya XL valizle geldi.
- **Kural:** Esnaf, dükkan panelinden boyutu revize eder. Misafir farkı onaylayıp ödemeden "Check-in" QR okutulamaz.

---

## 🔴 3. Kriz Senaryoları (Bad Cases)

### Vaka 3.1: Dükkanın Kapanış Saatini Geçmek
- **Durum:** Dükkan 20:00'de kapandı, misafir 20:15'te geldi ve dükkan kapalı.
- **Kural:** Misafir 18:00'den beri her 15 dakikada bir uyarı mesajı almıştır. Sorumluluk misafirdedir. Valiz ertesi sabah açılışta teslim edilir. Geceleme ücreti + ceza tahsil edilir.

### Vaka 3.2: Dükkanın Erken Kapanması
- **Durum:** Esnaf acil bir durumdan dükkanı saatinden önce kapattı ve misafir kapıda kaldı.
- **Kural:** Esnaf ağır kusurludur. Misafirin o gecelik otel/acil harcaması (belge ile) platform tarafından esnafın hakedişinden düşülerek ödenir.

---

## 💀 4. En Kötü Senaryolar (Worst Cases)

### Vaka 4.1: Valizin Kaybolması veya Çalınması
- **Durum:** Valiz yerinde yok.
- **Kural:** Esnaf dükkan kamerası kayıtlarını sunar. Polis tutanağı tutulur. 24 saat içinde 5.000 TL'ye kadar hasar tazminatı platform tarafından ödenir. Esnafın adli sicili ve kusuru incelenir, gerekirse platformdan kalıcı olarak atılır.

### Vaka 4.2: Valiz İçindeki Hasar ve İtiraz
- **Durum:** Misafir "valizim dükkanda kırılmış" veya "içinden eşya eksilmiş" diyor.
- **Kural:** Check-in anındaki mühürlü fotoğraf baz alınır. Mühür saglam teslim edildiyse itiraz reddedilir. Mühürde oynama varsa esnaf sorumlu tutulur.

---
*İş Operasyonları Direktörlüğü - Emanetçi.*
