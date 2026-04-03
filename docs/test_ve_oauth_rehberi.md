# Emanetçi: Test Senaryoları ve OAuth Entegrasyon Rehberi

Daha önce kurduğunuz sistemin devamı niteliğinde, manuel kontrolleriniz ve canlıya çıkış (production) hazırlığı için bu rehber hazırlanmıştır.

---

## 1. OAuth (Google & Apple) Kurulum ve Ortam Değişkenleri Rehberi

Uygulamanın kimlik doğrulama işlemleri `Auth.js (Next-Auth)` üzerinden çalışmaktadır. `.env` dosyanızda bulunan `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_ID`, `APPLE_SECRET` değerlerini doldurmanız gerekmektedir. 

### Google Entegrasyonu
1. **Google Cloud Console'a gidin** (https://console.cloud.google.com).
2. Yeni bir proje oluşturun veya var olanı seçin.
3. Menüden **APIs & Services > Credentials** (Kimlik Bilgileri) kısmına tıklayın.
4. **Create Credentials > OAuth client ID** seçeneğini tıklayın. *(Uygulama tipi: Web application)*
5. **Authorized redirect URIs** alanına şunları ekleyin:
   - Lokal için: `http://localhost:3000/api/auth/callback/google`
   - Canlı için: `https://siteniz.com/api/auth/callback/google`
6. Karşınıza çıkan **Client ID** ve **Client Secret** değerlerini doğrudan `.env` dosyanıza `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` olarak kopyalayın.

### Apple Entegrasyonu
*Not: Apple Sign-In kurulumu biraz daha meşakkatlidir ve bir Apple Developer hesabı (Yıllık 99$) gerektirir.*
1. **Apple Developer portalına** giriş yapın (https://developer.apple.com).
2. **Certificates, Identifiers & Profiles** sayfasına gidin.
3. Öncelikle bir **Identifiers (Service IDs)** oluşturun ve *Sign In with Apple* yetkisini aktif edin. 
   - Return URL alanına: `https://siteniz.com/api/auth/callback/apple` yazın. (Apple, localhost kabul etmez, tünel veya test domaini gerekir).
4. Ardından **Keys** bölümünden yeni bir anahtar oluşturun, yine *Sign In with Apple*'ı seçin ve az önce oluşturduğunuz Service ID'ye bağlayın.
5. Bir `.p8` formatında özel anahtar indireceksiniz.
6. Apple tarafında size doğrudan bir "Secret" verilmez. Bu `.p8` anahtarı, Team ID ve Key ID'yi kullanarak ruby scriptleri veya web toolları ile 6 aylık bir **Client Secret JWT** üretmeniz gerekir. 
7. Ürettiğiniz Secret ve Service ID'yi `.env` dosyasına kaydedin (`APPLE_ID` = Service ID, `APPLE_SECRET` = oluşturduğunuz JWT Secret).

---

## 2. Kapsamlı Manuel Test Senaryoları

Sistemin bütünlüğünü test etmek için (zombie process olarak çalışan playwright testleri dahilindeki senaryolara ek/benzer olarak) aşağıdaki akışları kendiniz bizzat test etmelisiniz:

### A. Misafir (Turist) Akışı Testleri
1. **Arama ve Listeleme:**
   - Anasayfadaki arama çubuğunu kullan.
   - Belirli bir lokasyonda sadece `isActive: true` ve kapasitesi boş olan dükkanlar gelmeli.
2. **Rezervasyon Oluşturma & iyzico Ödeme Modülü:**
   - Bir dükkan seç, check-in ve check-out tarihlerini ayarla.
   - S/M/XL boyutlarında farklı valiz sayıları seç, dinamik fiyatlamayı kontrol et.
   - iyzico Sandbox test kartlarıyla Checkout sayfasından ödeme yap.
   - Veritabanında `status = PAID` olduğunu doğrula.
3. **Kapasite Valisyonu (Hata Testi):**
   - Kapasitesi 5 olan bir dükkana 6 valiz rezervasyon yapmayı dene. Sistemin "Kapasite dolu" hatası vermesi gerekiyor.

### B. Esnaf (Partner) Akışı Testleri
1. **Partner Girişi ve Demo Modu:**
   - `auth/signin` ekranından "admin@emanetci.com" veya "esnaf@örnek.com" (demo modunda belirlenen maillerden biriyle) Google vs girmeden girmeyi test et.
2. **Kamera ve QR Okutma (Kritik):**
   - Giriş yaptıktan sonra **YENİ VALİZ TESLİM AL** butonuna basıp kameranın düzgün açıldığını gör.
   - (Mevcutta burası simulasyon). Test karekodunu okuttuğunda çıkan ekrandan onay ver.
3. **Ayarlar Güncellemesi:**
   - Esnaf panelinde ayarlara gir.
   - Dükkan kapasitesini, açılış ve kapanış saatini değiştir.
   - Veritabanında değişikliklerin yandıyıp yansımadığını (`Shop` tablosu) kontrol et.

### C. Yönetici (Admin) Paneli Testleri
1. **Dükkan / Esnaf Başvuru Onayı:**
   - Sisteme yeni kayıt olan bir esnaf (Shop tablosunda) `isActive: false` olarak düşer. 
   - Admin uygulamaları (`/admin/applications/page.tsx`) üzerinden başvuruyu onayla, `isActive: true`'ya çek. 
   - Onaylanana dek esnafın dükkanı *Guest (Turist)* aramasında çıkmamalı.
2. **Mühür Fotoğrafı ve Güvenlik Denetimi (Dört Göz İlkesi):**
   - Check-in yapılan bir rezervasyonda (`CheckInAction`), çekilen mühür fotoğrafının admin tarafında gözüküp gözükmediğini kontrol et.

---
*Uygulama yayına alınmadan önce `package.json` üzerindeki `test:e2e` betiğini çalıştırarak uçtan uca senaryoların yeşile döndüğünden emin olun.*
