# 📦 Emanetçi: Nihai Ürün ve Operasyon Özeti

Bu doküman, "Emanetçi" platformunun tüm işleyişini, kurallarını ve teknik altyapısını en net haliyle özetler.

---

### 🟢 1. Kullanıcı ve Esnaf Yolculuğu (Operasyonel Akış)

| Aşama | **Misafir (Gezgin) Aksiyonu** | **Esnaf (İş Ortağı) Aksiyonu** | **Sistem Çıktısı** |
| :--- | :--- | :--- | :--- |
| **1. Rezervasyon** | Haritadan seçer, öder. | Bildirim alır, "Onayla"r. | QR Kod üretilir. |
| **2. Bırakma (In)** | QR'ı gösterir, valizi verir. | QR'ı okutur, mühürü takar, foto çeker. | Sigorta başlar, bildirim gider. |
| **3. Alma (Out)** | QR'ı gösterir, valizi teslim alır. | QR'ı okutur, mühürü kontrol eder. | Ödeme esnafa yatar, değerlendirme istenir. |

---

### 🛡️ 2. Hukuki ve Finansal Parametreler

| Parametre | **Detay / Limit** | **Açıklama** |
| :--- | :--- | :--- |
| **Fiyatlandırma** | 60 - 80 TL / Günlük | Bölgeye göre dinamik ayarlanabilir. |
| **Gelir Paylaşımı** | %50 Esnaf, %50 Platform | iyzico ve sigorta platform payından düşer. |
| **Tazminat Limiti** | Valiz başına **5.000 TL** | Değerli eşya (altın, nakit) kapsam dışıdır. |
| **Mühürleme** | Seri No'lu Plastik Mühür | Valiz fermuarları için zorunludur. |
| **İptal Şartı** | Teslimata 1 saat kala | %100 kesintisiz iade hakkı. |

---

### ⚙️ 3. Teknik Mimari ve Güvenlik

| Bileşen | **Seçilen Teknoloji** | **Amacı** |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router) | Hız, SEO ve PWA (Mobil Uygulama benzeri web). |
| **Ödeme** | iyzico Marketplace API | Otomatik komisyon dağıtımı ve güvenli tahsilat. |
| **Harita** | Google Maps SDK | Lokasyon bazlı en yakın nokta gösterimi. |
| **Güvenlik** | İmzalı QR (Signed JWT) | Sahteciliği önlemek için süreli QR kodlar. |

---

### 📈 4. Pazarlama ve Lansman (GTM) Planı

| Kanal | **Hedef Kitle** | **Aksiyon** |
| :--- | :--- | :--- |
| **Noktasal (Offline)** | Airbnb Misafirleri | Airbnb kapı girişlerine QR kodlu fiziksel etiketler. |
| **Dijital (Ads)** | Turistik Aramalar | Google Maps'te "Locker" kelimesine öncelik. |
| **Ortaklık** | Yerel Tur Rehberleri | Gruplarını yönlendirmeleri için komisyonlu referral. |

---
*Nihai Ürün Özeti - Emanetçi Takımı İçin Hazırlanmıştır.*
