# Emanetçi: Bildirim ve İletişim Akışları (Notification Matrix)

Bu doküman, misafir ve esnaf (iş ortağı) uygulamasını kullanırken sistemin hangi aşamada kimlere hangi kanaldan (Push, Email, SMS) bilgilendirme yapacağını haritalandırır. Doğru iletişim, süreçteki iptalleri ve müşteri şikayetlerini %80 oranında azaltır.

---

## 📱 1. Misafir (Gezgin) Bildirim Akışları

| Tetikleyici Olay (Trigger) | Kanal | Alıcı | İçerik Özeti (Mesaj) |
| :--- | :--- | :--- | :--- |
| **Kayıt ve Hesap Doğrulama** | Email / SMS | Misafir | "Emanetçi'ye hoş geldin! Hesabını doğrulamak için kod: 123456" |
| **Rezervasyon Başarılı (Ödeme Alındı)** | Email & Push | Misafir | "Rezervasyon Onaylandı! PNR: #X1Y2Z3. Mağazaya giderken lütfen hazır bulunduracağın QR Koduna tıkla." |
| **Check-in Yaklaşıyor (Son 1 Saat)** | Push | Misafir | "Emanet saatiniz yaklaşıyor. [Esnaf Adı] mağazası sizi bekliyor! Yol tarifi al." |
| **Valiz Başarıyla Bırakıldı (Check-in)** | Push | Misafir | "İşlem başarılı! Valizlerin güvenle mühürlendi. Seni bekliyor olacak." |
| **Check-out Yaklaşıyor (Son 30 Dk)** | Push | Misafir | "Valizlerini alma vaktin yaklaşıyor. Saat 18:00'den önce mağazada olmanı tavsiye ederiz." |
| **Check-out Saatini Geçirme (Uyarı)** | SMS & Push | Misafir | "Dikkat: Teslim alma saatini geçirdin. Esnaf beklemede, ilk 15 dk ücretsizdir ancak sonrasında ek ücret yansıtılacaktır." |
| **Valiz Başarıyla Alındı (Check-out)** | Email & Push | Misafir | "Valizlerini başarıyla teslim aldın. Deneyimi değerlendirerek diğer gezginlere yardımcı ol!" (Değerlendirme Ekranına link) |

---

## 🏪 2. Esnaf (İş Ortağı) Bildirim Akışları

| Tetikleyici Olay (Trigger) | Kanal | Alıcı | İçerik Özeti (Mesaj) |
| :--- | :--- | :--- | :--- |
| **Yeni Başvuru Alındı** | Email | Esnaf | "Başvurunuz alındı. Ekibimiz belgelerinizi inceliyor, 24 saat içinde dönüş yapacağız." |
| **Başvuru Onayı (Mağaza Aktifte)** | WhatsApp / SMS | Esnaf | "Tebrikler! Mağazanız haritada aktif. Sadece misafir geldiğinde QR okutmanız yeterli!" |
| **Misafir Gecikti (No-Show)** | In-App (Panel) | Esnaf | "Misafir check-out saatini geçirdi. Açık olan valizler sistemce takip edilmektedir." |
| **Check-in Başarılı** | In-App | Esnaf | "Check-in tamamlandı! Lütfen valizleri belirttiğiniz güvenli alana yerleştirin." |
| **Haftalık Hak Ediş Yatırıldı** | Email | Esnaf | "Tebrikler! Bu haftaki kazancınız olan X TL, IBAN hesabınıza gönderildi." |

---

## ⚙️ 3. Sistem (Admin/Operasyon) Uyarıları

| Tetikleyici Olay | Kanal | Alıcı | Durum |
| :--- | :--- | :--- | :--- |
| **Chargeback (Ters İbraz) Talebi** | Slack/Email | Finans Ekibi | İyzico'dan itiraz düştüğünde operasyonun log belgelerini hazırlaması gerekir. |
| **Peş Peşe 3 Kötü Yorum (1 Yıldız)** | Slack / Panel | Destek Ekibi | Bir mağaza üst üste kötü yorum alırsa inceleme (Quality Assurance) flag'i açılır. |
| **Esnafın Kapanış Saatini Geçmesi** | SMS (Escalation) | Operasyon, Esnaf | Sistemde valiz varken dükkan kapanıyorsa, kriz yönetimi tetiklenir. |

---
*Müşteri İletişim ve Operasyon Tasarım Ekibi - Emanetçi.*
