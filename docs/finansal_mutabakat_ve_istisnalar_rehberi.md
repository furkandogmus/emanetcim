# Emanetçi: Finansal Mutabakat ve İstisnalar Rehberi


---

## 1. Tahsilat ve Bölüştürme Akışı (Standard Flow)

| Aktör | **Girdi / Aksiyon** | **Süreç** | **Sonuç** |
| :--- | :--- | :--- | :--- |

---

## 2. İade ve İptal Senaryoları (Refunds)

### Vaka 2.1: Tam İade (Full Refund)
- **Sonuç:** Platform ve esnaf payı dahil tüm tutar misafire geri döner.

### Vaka 2.2: Kısmi İade (Partial Refund)
- **Kural:** 3 valizden 1'i iade edilmek istendiğinde, valiz bazlı (`paymentTransactionId`) kısmi iade işlemi yapılır.
- **Sonuç:** Kalan 2 valizin bedeli üzerinden hakediş hesaplanmaya devam eder.

---

## 3. Finansal Uyuşmazlıklar (Disputes & Chargebacks)

### Vaka 3.1: Ters İbraz (Chargeback)
- **Durum:** Misafir bankasına "bu harcamayı ben yapmadım" deyip parayı geri ister.
- **Sonuç:** Kanıt kabul edilirse para esnafta kalır. Edilmezse tutar esnafın o haftaki alacağından düşülür.

### Vaka 3.2: Hakediş İtirazı
- **Durum:** Esnaf "sistem bana eksik ödeme yaptı" diyor.

---

## 4. Ceza ve Kesinti Protokolü

- **Gecikme Kesintisi:** Misafir valizini 2 saat geç aldıysa, misafir kartından otomatik çekilen ek bedelin **%70'i esnafa (fazladan beklediği için)**, %30'u platforma (operasyon maliyeti) pay edilir.
- **Ödenmeyen Ek Hizmet:** Eğer misafir ek hizmet (Örn: XL Bagaj farkı) ödemeden valizini zorla almak isterse, esnafın sistemi "Teslim Edilemez" uyarısı verir ve misafir bloke edilir.

---

## 5. Vergilendirme ve Faturalandırma

- **Platform:** "Hizmet Bedeli" için misafire e-arşiv fatura düzenler.
- **Esnaf (Alt Üye İşyeri):** Aldığı kira bedeli için misafire fiş/fatura kesmekle yükümlüdür (Sözleşme Maddesi).

---
*Finans ve Muhasebe Direktörlüğü - Emanetçi.*
