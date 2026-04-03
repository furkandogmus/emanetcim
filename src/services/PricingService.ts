/**
 * PricingService - Emanetçi Fiyatlandırma ve İade Motoru
 * Hem rezervasyon tutarını hem de erken teslimat iadelerini hesaplar.
 */
export class PricingService {
  /**
   * Rezervasyon tutarını hesaplar.
   * @param totalBags Toplam valiz sayısı
   * @param days Gün sayısı (Minimum 1)
   * @param pricePerDay Dükkanın günlük birim fiyatı
   */
  calculateTotal(totalBags: number, days: number, pricePerDay: number): number {
    const calculatedDays = Math.max(1, Math.ceil(days));
    const total = totalBags * calculatedDays * pricePerDay;
    return Math.round(total * 100) / 100;
  }

  /**
   * Erken teslimat durumunda iade tutarını hesaplar.
   * Kural: Tamamlanmamış her "Tam Gün" (24 saatlik blok) iade edilir.
   * @param booking Rezervasyon verisi
   * @param actualCheckOut Gerçek teslim alma zamanı
   */
  calculateEarlyRefund(booking: any, actualCheckOut: Date): number {
    const checkInTime = new Date(booking.checkInTime);
    const scheduledCheckOutTime = new Date(booking.checkOutTime);
    
    // Planlanan Toplam Süre (Mil saniye)
    const plannedDuration = scheduledCheckOutTime.getTime() - checkInTime.getTime();
    const plannedDays = Math.max(1, Math.ceil(plannedDuration / (1000 * 60 * 60 * 24)));
    
    // Gerçekleşen Süre
    const actualDuration = actualCheckOut.getTime() - checkInTime.getTime();
    const completedDays = Math.max(1, Math.ceil(actualDuration / (1000 * 60 * 60 * 24)));
    
    // İade Edilecek Gün Sayısı
    const savedDays = Math.max(0, plannedDays - completedDays);
    
    if (savedDays <= 0) return 0;

    // Birim Fiyat (Valiz Başı Günlük) - Rezervasyon anında kaydedilen unitPrice kullanılmalı.
    const unitPrice = booking.unitPrice || 50; // Fallback
    const totalBags = (booking.bagCountS || 0) + (booking.bagCountM || 0) + (booking.bagCountXl || 0);
    
    // İade Tutarı: (Kalan Günler * Toplam Valiz * Birim Fiyat) - %10 Hizmet Bedeli Kesintisi
    const rawRefund = savedDays * totalBags * unitPrice;
    const finalRefund = rawRefund * 0.9; // Platform masrafı korunur.

    return Math.round(finalRefund * 100) / 100;
  }
}

export const pricingService = new PricingService();
