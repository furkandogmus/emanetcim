# Emanetçi: Detaylı Kullanıcı Senaryoları (Use Cases)

Uygulamanın ölçeklenebilir bir teknik mimariye kavuşması için sistem üzerindeki tüm etkileşim noktaları detaylandırılmıştır. Toplam 28 ana Use Case mevcuttur.

---

## 🎒 1. Misafir (Gezgin) Akışları

| ID | Senaryo (Use Case) | Ön Koşul | Akış Adımları | Başarı / Çıktı |
| :--- | :--- | :--- | :--- | :--- |
| **UC_M_01** | **Kayıt ve Oturum Açma** | Kullanıcının uygulamayı açması | 1. Telefon numarası / E-posta veya Social Login (Google/Apple) seçilir.<br>2. OTP kodu veya OAuth ile doğrulama yapılır. | Sistemde oturum açılır, profil oluşur. |
| **UC_M_02** | **Konum Bazlı Arama** | Konum izni verilmesi | 1. Kullanıcı hedef lokasyon veya mevcut konum girer.<br>2. Haritada uygun emanetçiler (Fiyat/Puan) pin olarak belirir. | Seçenekler haritada/listede sıralanır. |
| **UC_M_03** | **Mağaza Detay İnceleme** | Bir pime tıklanması | 1. Dükkan fotoğrafları, çalışma saatleri, sigorta güvencesi detayları açılır.<br>2. Kullanıcı yorumları okunur. | Karar verme aşamasına geçilir. |
| **UC_M_04** | **Rezervasyon Formu** | Mağazanın "Seç" butonuna basılması | 1. Bırakma/Alma tarihi ve saati seçilir.<br>2. Valiz Adedi ve Boyutu (S, M/L, XL) belirlenir.<br>3. Toplam fiyat hesaplanır. | Sepet/Özet ekranına geçilir. |
| **UC_M_05** | **Güvenli Ödeme** | Özette Onay verilmesi | 1. iyzico ödeme sayfası (iframe/popup) açılır.<br>2. 3D Secure ile ödeme tamamlanır veya kayıtlı kart seçilir. | Rezervasyon onaylanır, PNR kodu üretilir. |
| **UC_M_06** | **Aktif QR Kod Gösterimi** | Başarılı Rezervasyon | 1. Ekranda "Aktif Rezervasyonunuz" belirir.<br>2. Check-in için dinamik bir QR kod oluşturulur. | Müşteri dükkana gittiğinde kullanıma hazırdır. |
| **UC_M_07** | **İptal ve İade (Süreç İçi)** | Rezervasyon saati gelmemiş olması | 1. Kullanıcı iptal politikası uyarınca "İptal Et" tuşuna basar.<br>2. Neden seçilir, sistem iyzico iadesini tetikler. | Para iadesi bankaya iletilir, esnafa bildirim gider. |
| **UC_M_08** | **Rezervasyon Güncelleme** | Valizin henüz check-in olmaması veya ek süre istenmesi | 1. Kullanıcı "Süreyi Uzat" veya "Boyut Değiştir (S'den L'ye)" der.<br>2. Çıkan fiyat farkını öder. | Rezervasyon saat/boyut bilgisi güncellenir. |
| **UC_M_09** | **Check-in (Valiz Teslimi)** | Dükkana varılması | 1. Misafir telefonundaki QR Kodu esnafa gösterir.<br>2. Esnaf okutunca işlem tamamlanıp bildirim gelir. | Sorumluluk esnafa ve sigortaya geçer. |
| **UC_M_10** | **Check-out (Valizi Alma)** | Valizini geri isteme zamanı | 1. Kullanıcı "Teslim Al" QR kodunu gösterir.<br>2. Esnaf okutup mühürleri kontrol ettirerek teslim eder. | İşlem tamamlanır, rezervasyon kapatılır. |
| **UC_M_11** | **Değerlendirme (Rating)** | Check-out sonrasındaki ilk 24 saat | 1. Uygulama anlık bildirim atar "Deneyim nasıldı?".<br>2. 1-5 yıldız arası puan ve Yorum girilir. | Yorum onaydan geçtikten sonra esnafın profilinde yayınlanır. |
| **UC_M_12** | **Geçmiş İşlemler & Fatura** | Süreç tamamlanmış olması | 1. Profil > Geçmiş sekmesinden alınan hizmetin detayı açılır.<br>2. "E-Fatura İndir" butonuna basılır. | PDF E-Arşiv fatura görüntülenir. |

---

## 🏪 2. Esnaf (İş Ortağı) Akışları

| ID | Senaryo (Use Case) | Ön Koşul | Akış Adımları | Başarı / Çıktı |
| :--- | :--- | :--- | :--- | :--- |
| **UC_E_01** | **Esnaf Başvurusu** | İşletmenin platforma dahil olmak istemesi | 1. "İş Ortağı Ol" formuna iletişim, dükkan ismi ve Vergi/Mersis No girilir.<br>2. Dükkan dışı ve içi depo alanı fotoğrafları yüklenir. | Kayıt bekleme (In-Review) durumuna geçer. |
| **UC_E_02** | **Profil / Kapasite Ayarı** | Onaylı bir hesap | 1. Esnaf panelinde çalışma saatlerini ve günlük boş valiz kapasitesini (örn: 10 adet) günceller.<br>2. İsterse "Bugün Emanet Alma" diyerek tatil moduna alır. | Haritada misafirlere uygunluk statüsü yansır. |
| **UC_E_03** | **Aktif Takvim Görüntüleme** | Panel açılışı | 1. O gün veya haftaki tüm check-in / check-out hareketleri liste halinde (Saat sırasında) görülür. | Esnaf ne zaman dükkanda olması gerektiğini bilir. |
| **UC_E_04** | **Check-in (Kabul İşlemi)** | Misafirin dükkana gelmesi | 1. Panelden "QR Oku" diyerek kamera açılır.<br>2. Misafirin kodu okunur, sipariş detayları kontrol edilir. | Misafirin valizi onaylanır, doğrulama biter. |
| **UC_E_05** | **Hasar/Mühür Kaydı Seçimi** | Check-in aşamasında olması | 1. Esnaf, standart plastik mührü takar.<br>2. Mührün ve valizin fotoğrafını zorunlu olarak yükler (Sistem kaydı). | Olası bir uyuşmazlıkta (Dispute) kanıt olarak tutulur. |
| **UC_E_06** | **Check-out İşlemi** | Misafirin valizi almaya gelmesi | 1. Teslim Alma QR Kodu kameraya okutulur.<br>2. Sistemde durum "Sorunsuz Teslim Edildi" olarak güncellenir. | Esnafın hakedişi bakiyesine yansıtılır. |
| **UC_E_07** | **Misafir Gecikme Bildirimi** | Check-out saati geçmişse | 1. Esnaf sistemde "Misafir Gecikti" butonuna basar.<br>2. Ek ceza sistemi tetiklenir veya dükkan kapanıyorsa nöbetçi tesise transfer vs. devreye girer. | Sorumluluk misafire aktarılır. |
| **UC_E_08** | **Extradan Ücret Tahsili** | Yanlış valiz beyanı (Örn: S dendi ama XL getirdi) | 1. Esnaf Check-in sırasında "Boyut Farkı Bildir" tuşuna basar.<br>2. Misafirin uygulamasına ödeme linki düşer, misafir ödemeden devam edilemez. | Kaçak boyutlandırma / ücret atlaması önlenir. |
| **UC_E_09** | **Cüzdan / Hakediş Kontrolü** | Kazanç işlemi | 1. Sistemde biriken TL bakiye, geçmiş dönem ödemeleri ve dekontlar incelenir.<br>2. Toplam ciro ve yatacak tarih görülür. | Mali şeffaflık sağlanır. |

---

## 🛡️ 3. Admin (Sistem Yöneticisi) Akışları

| ID | Senaryo (Use Case) | Ön Koşul | Akış Adımları | Başarı / Çıktı |
| :--- | :--- | :--- | :--- | :--- |
| **UC_A_01** | **Esnaf Başvuru Onayı** | Bekleyen bir esnaf başvurusu | 1. Admin belge doğrulamasını yapar, dükkan lokasyonunu Google Street View'dan teyit eder.<br>2. İçi uygunsa onaylar, sisteme starter mühür kiti kargo ataması düşer. | Esnaf platformda aktiflenir. |
| **UC_A_02** | **Kullanıcı Modifikasyonu** | Kural ihlali veya destek talebi | 1. Uygunsuz davranan Misafir veya Esnafın üyeliği askıya alınır (Ban).<br>2. Esnafın valiz kapasitesine platform tarafından manuel müdahale edilebilir. | Kalite standardı korunur. |
| **UC_A_03** | **Uyuşmazlık (Hasar/Çalıntı)** | Şikayet bileti açılması | 1. Admin "İtiraz" biletinde, valizin ilk girerken esnafça çekilmiş Mühürlü Fotoğrafını açar.<br>2. Son duruma bakarak platform iadesini veya tamirat fonunu başlatır. | 5.000 TL sigorta limiti içinde kriz çözülür. |
| **UC_A_04** | **İptal & İade Tetikleme** | Haklı bir müşteri talebi | 1. Beklenmedik durum (esnafın erken dükkan kapatması) yaşanırsa, admin iyzico API'sine manuel iade talebi vurur. | %100 iade gerçekleşir, esnafa (hakedişinden) ceza yansıtılır. |
| **UC_A_05** | **Platform Ciro Raporlaması** | Finansal dönem sonu | 1. Toplam rezervasyonlar, iyzico maliyetleri, iptaller filtreyle çekilir.<br>2. Hangi şehirde (İstanbul/Antalya vb.) en çok gelir elde edildiği grafiklenir. | Büyüme takibi yönetime aktarılır. |
| **UC_A_06** | **Pazarlama / Promosyon Kodu Oluşturma** | Kampanya dönemi | 1. Admin panele "YAZ10" kodu tanımlar, %10 veya 20 TL indirim opsiyonu ekler.<br>2. İndirimin kimden (platform komisyonundan) kesileceğini belirtir. | Müşteriler sepette kodu kullanmaya başlar. |
