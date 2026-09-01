import prisma from "@/lib/db";
import { isShopOpenForHandover } from "@/lib/shop-hours";

/**
 * Bir ayar değişikliğinin MEVCUT rezervasyonlara etkisi.
 *
 * NEDEN VAR (2026-09-01): `updateShopSettingsAction` yalnızca BİÇİM
 * doğruluyordu (`HH:mm` mi, kapasite tamsayı mı) ve değişikliğin zaten
 * kabul edilmiş rezervasyonlara ne yaptığını hiç sormuyordu.
 *
 * İki sessiz sonuç:
 *
 *   1. **Saat daraltma.** Esnaf 09:00–22:00'ı 09:00–18:00 yaparsa, 20:00
 *      check-in'li mevcut rezervasyonlar İMKÂNSIZ hâle gelir: check-in kapısı
 *      `SHOP_CLOSED` döner. Misafir valiziyle geliyor ve tezgâhta reddediliyor
 *      — `shop-hours.ts`teki yorumun anlattığı hatanın aynısı, bu sefer AYARLAR
 *      tarafından üretilmiş hâli.
 *   2. **Kapasite düşürme.** Rafta 26 valiz varken kapasiteyi 10'a çekmek,
 *      dükkanı kendi beyan ettiği sınırın üstünde bırakır.
 *
 * DEĞİŞİKLİK ENGELLENMİYOR, UYARILIYOR. Esnafın saatini değiştirme hakkı var
 * ve dükkanını kapatması gerekebilir; onu engellemek daha kötü olurdu. Doğru
 * olan, sonucu ÖNCEDEN söylemek — böylece esnaf o misafirlere ulaşabilir.
 */

export type SettingsImpact = {
  /** Yeni saatlerin dışında kalan, hâlâ aktif rezervasyon sayısı. */
  bookingsOutsideHours: number;
  /** Şu an rafta duran valiz sayısı yeni kapasiteyi aşıyor mu? */
  bagsOverCapacity: number;
};

/** Check-in'i hâlâ gerçekleşecek olan durumlar. */
const UPCOMING = ["WAITING_APPROVAL", "APPROVED", "PENDING", "PAID"] as const;

class ShopSettingsImpactService {
  async assess(params: {
    shopId: string;
    openingTime?: string;
    closingTime?: string;
    capacity?: number;
    now?: Date;
  }): Promise<SettingsImpact> {
    const { shopId, openingTime, closingTime, capacity, now = new Date() } = params;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { openingTime: true, closingTime: true, open247: true, timezone: true },
    });
    if (!shop) return { bookingsOutsideHours: 0, bagsOverCapacity: 0 };

    const nextOpening = openingTime ?? shop.openingTime;
    const nextClosing = closingTime ?? shop.closingTime;

    let bookingsOutsideHours = 0;
    /*
      7/24 dukkanda saat kontrolu yok; hesaplamaya da gerek yok. Saat alanlari
      hic degismediyse de sorgu bosuna calismasin.
    */
    const hoursChanged =
      (openingTime !== undefined && openingTime !== shop.openingTime) ||
      (closingTime !== undefined && closingTime !== shop.closingTime);

    if (!shop.open247 && hoursChanged) {
      const upcoming = await prisma.booking.findMany({
        where: {
          shopId,
          status: { in: [...UPCOMING] },
          checkInTime: { gte: now },
        },
        select: { checkInTime: true },
        take: 500,
      });
      /*
        Kontrol `isShopOpenForHandover` ile -- check-in kapisinin SORDUGU soru
        birebir bu. Burada ayri bir saat aritmetigi yazmak, iki tarafin
        ayrismasi demek olurdu; `shop-hours.ts` yorumu o hatanin bir kez
        yasandigini yaziyor.
      */
      bookingsOutsideHours = upcoming.filter(
        (b) =>
          !isShopOpenForHandover(
            nextOpening,
            nextClosing,
            shop.open247,
            b.checkInTime,
            shop.timezone ?? undefined,
          ),
      ).length;
    }

    let bagsOverCapacity = 0;
    if (capacity !== undefined) {
      const held = await prisma.booking.aggregate({
        where: { shopId, status: "CHECKED_IN" },
        _sum: { bagCountS: true, bagCountM: true, bagCountXl: true },
      });
      const bags =
        (held._sum.bagCountS ?? 0) + (held._sum.bagCountM ?? 0) + (held._sum.bagCountXl ?? 0);
      bagsOverCapacity = Math.max(0, bags - capacity);
    }

    return { bookingsOutsideHours, bagsOverCapacity };
  }
}

export const shopSettingsImpactService = new ShopSettingsImpactService();
