import { computeDailyBagLineTotal } from '@/lib/bag-pricing';
import { moneyToNumber } from '@/lib/money';

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
   * Günlük hizmet tutarı, S/M/XL çarpanları checkout ile aynı şekilde hesaplanır.
   */
  calculateEarlyRefund(
    booking: {
      checkInTime: Date | string;
      checkOutTime: Date | string;
      unitPrice?: unknown;
      bagCountS?: number | null;
      bagCountM?: number | null;
      bagCountXl?: number | null;
      totalPrice?: unknown;
      insuranceFee?: unknown;
    },
    actualCheckOut: Date
  ): number {
    const checkInTime = new Date(booking.checkInTime);
    const scheduledCheckOutTime = new Date(booking.checkOutTime);

    const plannedDuration = scheduledCheckOutTime.getTime() - checkInTime.getTime();
    const plannedDays = Math.max(1, Math.ceil(plannedDuration / (1000 * 60 * 60 * 24)));

    const actualDuration = actualCheckOut.getTime() - checkInTime.getTime();
    const completedDays = Math.max(1, Math.ceil(actualDuration / (1000 * 60 * 60 * 24)));

    const savedDays = Math.max(0, plannedDays - completedDays);

    if (savedDays <= 0) return 0;

    const unitPrice = moneyToNumber(booking.unitPrice) || 50;
    const dailyService = computeDailyBagLineTotal(
      unitPrice,
      booking.bagCountS ?? 0,
      booking.bagCountM ?? 0,
      booking.bagCountXl ?? 0
    );

    const rawRefund = savedDays * dailyService * 0.9;

    const insuranceFee = moneyToNumber(booking.insuranceFee);
    const servicePaid = Math.max(0, moneyToNumber(booking.totalPrice) - insuranceFee);

    const capped = Math.min(rawRefund, servicePaid);
    return Math.round(capped * 100) / 100;
  }
}

export const pricingService = new PricingService();
