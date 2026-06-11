# BagajPark (Emanetçi) Web vs. Mobil Özellik Karşılaştırma Matrisi (Web vs. Mobile Feature Comparison)

Bu doküman, Web (Next.js) ve Mobil (Flutter) uygulamaları arasındaki özellik eşliğini (Feature Parity) ve aktif işlevsel farkları (Gaps) listelemektedir. 

* **Son Güncelleme:** Haziran 2026
* **Durum Özeti:** Raporlanan 105 temel özelliğin büyük kısmında eşitlik (Parity) sağlanmıştır. Son yapılan güncellemelerle birlikte Misafir Rezervasyon Yönetimi (İptal, Değişiklik, Yorum/Değerlendirme, Uyuşmazlık Bildirme), Arama Filtreleri ve Esnaf Sipariş Onay/Reddetme/Telefon Güncelleme gibi kritik aşamalar **Mobil uygulamada da eşitlenmiştir (Parity/Fixed).**

---

## 🎒 A. MİSAFİR (GEZGİN) ÖZELLİKLERİ

### A1. Kimlik Doğrulama (Authentication)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 1 | Giriş (E-posta/Telefon + Şifre) | `/login/page.tsx` | `/auth/login` (`login_screen.dart`) | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 2 | Google ile Giriş | NextAuth Google | `login_screen.dart` / `/auth/google` | **Eşit (Parity)** | Mobil entegrasyonu tamamlandı. |
| 3 | Apple ile Giriş | NextAuth Apple | `login_screen.dart` / `/auth/apple` | **Eşit (Parity)** | Mobil entegrasyonu tamamlandı. |
| 4 | Kayıt Olma | `/register/page.tsx` | `/auth/register` (`register_screen.dart`) | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 5 | Şifremi Unuttum | `/auth/forgot-password/page.tsx` | `login_screen.dart` (İç diyalog) | **Eşit (Parity)** | Web'de özel sayfa, mobilde pop-up olarak çözülmüştür. |
| 6 | E-posta Doğrulama | `/auth/verify-email/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobil uygulamada e-posta doğrulama ekranı bulunmamaktadır. |
| 7 | Yeni Şifre Belirleme (Sıfırlama Sonrası) | `/auth/new-password/page.tsx` | *EKSİK* (API var) | **Fark (Gap)** | Mobil uygulamada deep-link şifre sıfırlama onay ekranı eksiktir. |
| 8 | Hata Sayfası (Auth Error) | `/auth/error/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobilde hatalar sayfa yerine inline/toast olarak gösterilir. |

### A2. Arama ve Mağaza Keşfi (Search & Shop Discovery)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 9 | Harita Üzerinde Arama | `/search/page.tsx` | `/search` (`search_screen.dart`) | **Eşit (Parity)** | Her ikisinde de harita entegrasyonu mevcuttur. |
| 10 | Arama Önerileri (Geocoding) | `geocodeSearchCenterAction` | Komoot Photon API | **Eşit (Parity)** | Farklı servisler kullanılmasına rağmen işlevsel olarak eşittir. |
| 11 | Filtre: Şu An Açık | `SearchClient.tsx` | `search_screen.dart` (`_onlyOpenNow`) | **Eşit (Parity)** | Mobilde filtre paneline eklendi. |
| 12 | Filtre: 7/24 Açık | `SearchClient.tsx` | `search_screen.dart` (`_only247`) | **Eşit (Parity)** | Mobilde filtre paneline eklendi. |
| 13 | Filtre: Minimum Puan | `SearchClient.tsx` | `search_screen.dart` (`_minRating`) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobil filtre sayfasına yıldız seçimi eklendi. |
| 14 | Filtre: Maksimum Fiyat | `SearchClient.tsx` | `search_screen.dart` (`_maxPrice`) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobil filtre sayfasına fiyat girişi eklendi. |
| 15 | Filtre: Tuvalet Mevcut | `SearchClient.tsx` | `search_screen.dart` (`_hasRestroom`) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobil filtre sayfasına eklendi. |
| 16 | Filtre: Kamera (CCTV) Mevcut | `SearchClient.tsx` | `search_screen.dart` (`_hasCctv`) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobil filtre sayfasına eklendi. |
| 17 | Filtre: Klima / İklimlendirme | `SearchClient.tsx` | `search_screen.dart` (`_hasClimate`) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobil filtre sayfasına eklendi. |
| 18 | Filtre: Büyük Eşya Kabulü | `SearchClient.tsx` | `search_screen.dart` (`_acceptsLarge`) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobil filtre sayfasına eklendi. |
| 19 | Sıralama (Uzaklık/Fiyat/Puan) | `SearchClient.tsx` | `search_screen.dart` (`_sortBy`) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde sıralama seçenekleri aktifleştirildi. |
| 20 | Favori Mağazalar | `use-favorites.ts` | `favorites_service.dart` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde favorilere ekleme ve listeleme eklendi. |
| 21 | Detay: Yorumlar Listesi | `ShopDetailClient.tsx` | `shop_detail_screen.dart` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde statik yazı yerine gerçek yorum listesi çekiliyor. |
| 22 | Detay: Galeri | `ShopGallery.tsx` | `shop_detail_screen.dart` | **Fark (Gap)** | Web'de çoklu resim galerisi var, mobilde tek bir ana görsel var. |
| 23 | Detay: Özellik Rozetleri | `ShopDetailClient.tsx` | `shop_detail_screen.dart` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde statik ikonlar yerine gerçek DB özellikleri gösteriliyor. |
| 24 | Detay: Puan ve Yorum Sayısı | `ShopDetailClient.tsx` | `shop_detail_screen.dart` | **Fark (Gap)** | Mobilde puan görünüyor ancak toplam yorum sayısı eksik. |
| 25 | Detay: Paylaş Butonu | Eksik | `share_service.dart` | **Eşit (Parity)** | Mobilde yerel paylaşım var, web'de eksik (kritik değil). |
| 26 | Detay: Doğrulanmış Mağaza | `ShopDetailClient.tsx` | `shop_detail_screen.dart` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde doğrulanmış mavi rozet (verified) simgesi eklendi. |

### A3. Rezervasyon Aşaması (Booking Flow)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 27 | Ödeme / Checkout Sayfası | `/checkout/[shopId]/page.tsx` | `checkout_screen.dart` | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 28 | Valiz Seçici (S/M/XL) | `BagSelector.tsx` | `checkout_screen.dart` | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 29 | Kupon Kodu Girişi | `CheckoutClient.tsx` | `checkout_screen.dart` | **Eşit (Parity)** | İndirim kuponu uygulanabiliyor. |
| 30 | Sigorta Bedeli Gösterimi | `CheckoutClient.tsx` | `checkout_screen.dart` | **Eşit (Parity)** | Sigorta bedeli hesaplanıp ekleniyor. |
| 31 | Neler Dahil Bölümü | `CheckoutWhatIsIncluded.tsx` | *EKSİK* | **Fark (Gap)** | Mobilde ödeme detay dökümü (güvence kapsamı vb.) eksik. |
| 32 | Valiz Boyut Rehberi | `BagSizeGuide.tsx` | *EKSİK* | **Fark (Gap)** | Mobilde hangi boyuta hangi valizin girdiği rehberi eksik. |
| 33 | Güvence Açıklamaları | `BagProtection.tsx` | *EKSİK* | **Fark (Gap)** | Mobil checkout ekranında güvence detayları eksik. |

### A4. Rezervasyon Yönetimi (Misafir - Guest)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 34 | Rezervasyonlarım Listesi | `/bookings/page.tsx` | `my_bookings_screen.dart` | **Eşit (Parity)** | Sorunsuz listeleniyor. |
| 35 | Rezervasyon Detayı | `/bookings/[id]/page.tsx` | `booking_detail_screen.dart` | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 36 | QR Kod Gösterimi | `BookingQrDisplay.tsx` | `booking_detail_screen.dart` | **Eşit (Parity)** | Konteyner teslim/alım QR kodları üretiliyor. |
| 37 | Rezervasyon İptali | `cancelBookingAction` | `_cancelBooking` (API çağrısı) | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde rezervasyon iptal aksiyonu ve API entegrasyonu tamamlandı. |
| 38 | Rezervasyon Düzenleme | `BookingModifyModal.tsx` | `_modifyBooking` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde tarih ve çanta sayısı güncelleme arayüzü eklendi. |
| 39 | Uyuşmazlık / Şikayet | `DisputeForm.tsx` | `_showDisputeSheet` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde hasar/çalıntı şikayet formu eklendi. |
| 40 | Onaylı Rezervasyonu Ödeme | `/bookings/[id]/pay/page.tsx` | *EKSİK* | **Fark (Gap)** | Sonradan ödemeli akış mobilde eksik; checkout'ta direkt ödeniyor. |
| 41 | Makbuz / Fiş Yazdırma | `PrintButton.tsx` | *EKSİK* | **Fark (Gap)** | Mobilde fiş PDF veya yazdırma seçeneği bulunmuyor. |
| 42 | Google Takvim Entegrasyonu | `BookingDetailActions.tsx` | *EKSİK* | **Fark (Gap)** | Mobilde takvime ekleme butonu bulunmuyor. |
| 43 | Mühür Numaralarını Görme | Detay sayfasında mühür listesi | `bookingSealsProvider` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde valizlere takılan mühür numaraları listeleniyor. |
| 44 | İptal Politikası Gösterimi | `CancellationPolicy.tsx` | `_showCancellationPolicy` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde iptal kuralları detay paneli açılıyor. |
| 45 | Onay Sonrası Ödeme | `/bookings/[id]/pay` | *EKSİK* | **Fark (Gap)** | Web'deki onay bekleyen ödeme akışı mobilde bulunmuyor. |
| 46 | Yorum ve Puan Gönderme | `ReviewForm.tsx` | `_showReviewSheet` | **Eşit (Parity) [DÜZELTİLDİ]** | Mağazayı değerlendirme ve yorum yazma formu mobilde aktif. |

### A5. Profil ve Hesap Ayarları (Profile & Account)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 47 | Profil Sayfası | `/account/page.tsx` | `profile_screen.dart` | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 48 | İsim Düzenleme | Hesap Ayarları | `_showEditProfile()` | **Eşit (Parity)** | İsim güncellenebiliyor. |
| 49 | Profil Resmi Yükleme | Hesap Ayarları | `_pickAndUploadAvatar()` | **Eşit (Parity)** | Profil resmi güncellenebiliyor. |
| 50 | Telefon Numarası Düzenleme | Partner ayarlarında var | *EKSİK* (Guest profilinde) | **Fark (Gap)** | Mobil misafir profilinde telefon numarası güncellenemiyor. |
| 51 | Davet Kodu Gösterimi | `ReferralCodeCard.tsx` | `profile_screen.dart` | **Eşit (Parity)** | Referans kodu kartı mevcuttur. |
| 52 | Davet Kodu Paylaşımı | Kopyalama ve Paylaşım | Kopyalama ve Paylaşım | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 53 | Gizlilik ve Veri Yönetimi | `/account/privacy/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobil uygulamada gizlilik ve veri hakları yönetim sayfası eksik. |
| 54 | Verileri Dışa Aktarma (GDPR) | `/api/account/data-export` | *EKSİK* | **Fark (Gap)** | Profil verilerini JSON indirme seçeneği mobilde yok. |
| 55 | Hesabı Silme / Anonimleştirme | `anonymizeGuestAccountAction` | Hesap Silme Diyaloğu | **Eşit (Parity)** | Hesap silme isteği mobilde de tetiklenebiliyor. |
| 56 | Bildirim İzin Ayarı (Web Push) | `WebPushOptIn` | `push_service.dart` (Arka plan) | **Fark (Gap)** | Mobilde izin açma/kapatma kullanıcı arayüzü (UI) bulunmamaktadır. |
| 57 | Çıkış Yapma | Web Header | `_confirmLogout()` | **Eşit (Parity)** | Sorunsuz çalışıyor. |
| 58 | Sadakat Puanı / İstatistikler | Puan Durumu | `profile/stats` API | **Eşit (Parity)** | Loyalty puanı ve istatistikler listeleniyor. |

### A6. Bildirimler (Notification Features)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 59 | Bildirim Listesi | *EKSİK* (Web'de liste yok) | `notifications_screen.dart` | **Mobil Önde** | Mobilde özel bildirim merkezi var, web'de yok. |
| 60 | Tümünü Okundu İşaretle | *EKSİK* | `markAllAsRead()` | **Mobil Önde** | Mobilde mevcut, web'de eksik. |
| 61 | Push Bildirim Kaydı | WebPush | `push_service.dart` (FCM) | **Eşit (Parity)** | Farklı kanallardan da olsa push bildirim gönderiliyor. |

### A7. Tanıtım ve Ana Sayfa (Home & Landing Pages)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 62 | Pazarlama Ana Sayfası | `/page.tsx` (Full site) | `home_screen.dart` (Minimal) | **Eşit (Parity)** | Mobil odaklı sade ana sayfa tasarımı mevcuttur. |
| 63 | Nasıl Çalışır? Bölümü | `HomeSearchWidget` | `HowItWorksSheet` | **Eşit (Parity)** | Web'de sayfa içi, mobilde alt panel olarak açılır. |
| 64 | Müşteri Yorumları (Testimonials) | `TestimonialCarousel` | *EKSİK* | **Fark (Gap)** | Mobil ana sayfada müşteri yorumları yer almamaktadır. |
| 65 | Fiyat Karşılaştırma Tablosu | `ComparisonTable` | *EKSİK* | **Fark (Gap)** | Mobilde karşılaştırma tabloları bulunmamaktadır. |
| 66 | Sadakat Rozetleri | `LoyaltyBadge` | *EKSİK* | **Fark (Gap)** | Sadakat seviye görselleri mobilde gösterilmemektedir. |

### A8. Statik / Kurumsal Sayfalar (Informational Pages)
| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 67 | Sigorta ve Güvence Detayı | `/insurance/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobil uygulamada sigorta detay sayfası eksik. |
| 68 | Hakkımızda Sayfası | `/about/page.tsx` | *EKSİK* (Profilde kısa yazı var) | **Fark (Gap)** | Ayrıntılı hakkımızda sayfası mobilde bulunmuyor. |
| 69 | SSS (F.A.Q) Sayfası | `/faq/page.tsx` | *EKSİK* | **Fark (Gap)** | Sıkça sorulan sorular mobilde eksik. |
| 70 | İletişim Formu | `/contact/page.tsx` | *EKSİK* (Sadece e-posta adresi) | **Fark (Gap)** | Mobilde iletişim formu bulunmamaktadır. |
| 71 | Kullanım Koşulları | `/terms/page.tsx` | *EKSİK* | **Fark (Gap)** | Kullanım sözleşmesi metni mobilde eksik. |
| 72 | Gizlilik Politikası | `/privacy/page.tsx` | *EKSİK* | **Fark (Gap)** | Gizlilik politikası metni mobilde eksik. |
| 73 | KVKK Bilgilendirmesi | `/kvkk/page.tsx` | *EKSİK* | **Fark (Gap)** | KVKK metinleri mobilde eksik. |
| 74 | İptal Politikası Metni | `/cancellation/page.tsx` | *EKSİK* | **Fark (Gap)** | İptal politikası detay sayfası mobilde eksik. |
| 75 | Otel İş Ortakları | `/hotels/page.tsx` | *EKSİK* | **Fark (Gap)** | Otel ortaklık bilgileri mobilde eksik. |
| 76 | Esnaf Başvuru Sayfası | `/become-partner/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobilden esnaf başvuru formu doldurulamamaktadır. |
| 77 | Şehir Depolama Sayfaları (SEO) | `/luggage-storage/page.tsx` | *GEREKSİZ* | **Eşit (Parity)** | SEO odaklı sayfalar mobil uygulama için kritik değildir. |
| 78 | Şehir/İlçe Özel SEO Sayfaları | `/luggage-storage/[slug]` | *GEREKSİZ* | **Eşit (Parity)** | Mobil için kritik değildir. |
| 79 | Blog Listesi | `/blog/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobil uygulamada blog yazıları bulunmamaktadır. |
| 80 | Blog Yazısı Detayı | `/blog/[slug]/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobil uygulamada blog detayları bulunmamaktadır. |

---

## 🏪 B. ESNAF (İŞ ORTAĞI - PARTNER) ÖZELLİKLERİ

| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 81 | Esnaf Paneli (Dashboard) | `/partner/page.tsx` (İstatistikler, bekleyen siparişler) | `/partner` (`partner_bookings_screen.dart`) | **Fark (Gap)** | Web'de grafikler ve hızlı özetler var; mobilde ise sadece rezervasyon listesi ve basit bakiye gösterilmektedir. |
| 82 | QR Kod Tarama (Check-in/out) | PartnerClient (Kamera) | `partner_scan_screen.dart` | **Eşit (Parity)** | Her iki tarafta da QR tarama modülü çalışıyor. |
| 83 | Kazanç ve Cüzdan Takibi | `/partner/earnings/page.tsx` (Detaylı aylık, yoğun saatler) | `partner_earnings_screen.dart` (Bakiye) | **Fark (Gap)** | Web arayüzü çok daha detaylı grafikler sunuyor; mobilde sadece toplam bakiye ve basit liste görünmektedir. |
| 84 | Mühür Yönetimi (Talep/İptal) | `/partner/seals/page.tsx` (Talep etme, teslim onay) | *EKSİK* (Sadece sayı yazar) | **Fark (Gap)** | Mobil uygulamadan yeni mühür siparişi verilememekte veya hatalı mühür bildirilememektedir. |
| 85 | Mağaza Ayarları (Kapasite, Fiyat, Saat) | `/partner/settings/page.tsx` | `partner_settings_screen.dart` | **Eşit (Parity)** | Kapasite, fiyat ve çalışma saatleri mobilde güncellenebilir. |
| 86 | Mağaza Konum Ayarları (Adres, İl, İlçe) | `PartnerShopSettingsForm` | `partner_settings_screen.dart` (`_address`, `_city`, `_district`) | **Eşit (Parity) [DÜZELTİLDİ]** | Adres, il ve ilçe alanları mobilden güncellenebiliyor. |
| 87 | İletişim Telefonu Güncelleme | `PartnerShopSettingsForm` | `partner_settings_screen.dart` (`_phone`) | **Eşit (Parity) [DÜZELTİLDİ]** | Esnaf dükkan telefon numarasını mobilden de güncelleyebiliyor. |
| 88 | Payout / Stripe Connect | Stripe Connect Entegrasyonu | *EKSİK* | **Fark (Gap)** | Hakediş banka hesabı bağlama akışı mobilde yoktur, web üzerinden yapılması gerekir. |
| 89 | Sipariş Listesi Filtreleme | `/partner/bookings/page.tsx` | `partner_bookings_screen.dart` | **Eşit (Parity) [DÜZELTİLDİ]** | Mobilde 'Tümü', 'Bekleyen', 'Aktif', 'Tamamlanan' sekmeleri eklendi. |
| 90 | Sipariş Onaylama / Reddetme | `PartnerBookingActionLinks` | `_approveBooking` / `_rejectBooking` | **Eşit (Parity) [DÜZELTİLDİ]** | Bekleyen rezervasyonlar mobilden onaylanabiliyor veya reddedilebiliyor. |
| 91 | Sipariş Detayı (Müşteri İletişim) | `/partner/bookings/[id]` | `partner_booking_detail_screen.dart` | **Eşit (Parity)** | Müşteri adı ve detayları görüntülenebiliyor. |
| 92 | Bagaj Sayısı Revizyonu | Yok | *EKSİK* (API var) | **Fark (Gap)** | Teslim sırasında çanta boyut/sayı farkı bildirme arayüzü mobilde eksiktir. |

---

## 🛡️ C. YÖNETİCİ (ADMIN) ÖZELLİKLERİ

| # | Özellik | Web Rotası/Dosyası | Mobil Rotası/Dosyası | Durum (Eşlik) | Açıklama |
|---|---|---|---|---|---|
| 93 | Admin Paneli (Dashboard) | `/admin/page.tsx` | `admin_dashboard_screen.dart` | **Eşit (Parity)** | Genel istatistikler görüntülenebiliyor. |
| 94 | Esnaf Başvuruları Yönetimi | `/admin/applications/page.tsx` | `admin_applications_screen.dart` | **Eşit (Parity)** | Başvurular listelenip onaylanıp reddedilebiliyor. |
| 95 | Admin Destek Mesajları | `/admin/messages/page.tsx` | `admin_messages_screen.dart` | **Eşit (Parity)** | Mesajlar görüntülenebiliyor. |
| 96 | Kullanıcı Yönetimi | `/admin/users/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobil admin panelinde kullanıcı engelleme/listeleme yoktur. |
| 97 | Mağaza Yönetimi (Genel) | `/admin/partners/page.tsx` | *EKSİK* | **Fark (Gap)** | Mobil admin dükkan detaylarını manuel düzenleyemez. |
| 98 | Mühür Kitleri Yönetimi | `/admin/seals/page.tsx` | *EKSİK* | **Fark (Gap)** | Mühür gönderimleri mobilden yönetilemez. |
| 99 | Kampanya Yönetimi | `/admin/campaigns/page.tsx` | *EKSİK* | **Fark (Gap)** | Kampanya/indirim kodu tanımlama mobilde yoktur. |
| 100| İtiraz / Şikayet Çözümü | `/admin/disputes/page.tsx` | *EKSİK* | **Fark (Gap)** | Müşteri şikayetleri mobilden yönetilemez. |
| 101| Sistem Durumu (Logs/Jobs) | `/admin/status/page.tsx` | *EKSİK* | **Fark (Gap)** | Cron veya sistem durum logları mobilde yoktur. |
| 102| Blog Yönetimi | `/admin/blog/page.tsx` | *EKSİK* | **Fark (Gap)** | Blog yazısı ekleme/silme mobilde yoktur. |
| 103| Platform Ayarları | `/admin/platform-settings/page.tsx` | *EKSİK* | **Fark (Gap)** | Komisyon, sigorta, ceza vb. ayarlar mobilde yoktur. |
| 104| Feature Flags Yönetimi | `/admin/feature-flags/page.tsx` | *EKSİK* | **Fark (Gap)** | Özellik bayrakları mobilden değiştirilemez. |
| 105| Rol Yetkilendirmeleri | `/admin/role-approvals/page.tsx` | *EKSİK* | **Fark (Gap)** | Kullanıcı rollerini değiştirme mobilde yoktur. |

---

## 🛑 D. AKTİF KALAN ÖNEMLİ EKSİKLİKLER (SUMMARY OF GAPS)

Mobil uygulamada henüz yer almayan ve geliştirilmesi gereken öncelikli alanlar şunlardır:

### 1. Misafir Tarafındaki Öncelikli Eksiklikler (Guest Gaps):
* **E-posta Doğrulama Akışı (P1):** Kayıt sonrasında e-posta doğrulaması mobilden tamamlanamıyor.
* **Şifre Sıfırlama Bağlantısı (P1):** E-posta ile gelen şifre sıfırlama linki tıklandığında mobilde yeni şifre belirleme ekranı açılmıyor.
* **Ücret Dökümü ve Valiz Rehberi (P2):** Checkout ekranında "neler dahil" ve çanta boyut rehberleri yer almıyor.
* **Veri İhracı / Gizlilik Ayarları (P3):** GDPR/KVKK uyumluluğu için veri dökümü alma seçeneği mobil ayarlarda eksik.

### 2. Esnaf Tarafındaki Öncelikli Eksiklikler (Partner Gaps):
* **Mühür Siparişi Arayüzü (P1):** Esnaf yeni mühür talebinde bulunamıyor veya hatalı mühürleri mobilden bildiremiyor (API'leri hazır ancak mobil UI'ı yok).
* **Stripe Connect Payout Entegrasyonu (P2):** Banka hesabı bağlama/ödeme alma ayarları sadece web üzerinden yapılıyor.
* **Sipariş Revizyonu (P2):** Teslimat anında ek çanta ekleme/çıkarma işlemi mobilden yönetilemiyor (API'si hazır, mobil UI eksik).

### 3. Yönetici Tarafındaki Eksiklikler (Admin Gaps):
* **Sistem ve Kullanıcı Yönetimi (P2):** Kampanya kodları, uyuşmazlık biletleri (disputes), platform ayarları ve kullanıcı engellemeleri yalnızca **Web Admin Panel** üzerinden gerçekleştirilebilir. Mobil admin paneli sadece başvuru ve istatistik odaklıdır.
