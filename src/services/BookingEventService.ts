import prisma from "@/lib/db";
import type { Role, Prisma } from "@prisma/client";
import logger from "@/lib/logger";
import { walletPassService } from "@/services/WalletPassService";

export type BookingEventType =
  | "CREATED"
  | "PAID"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "APPROVED"
  | "WAITING_APPROVAL"
  | "MODIFIED"
  | "DISPUTED"
  | "REFUNDED"
  | "SEAL_ASSIGNED"
  | "BAGS_MODIFIED"
  /**
   * Çıkış saati geçtiği hâlde rezervasyon hâlâ açık. Süre aşımı taraması yazar
   * (`OverdueBookingService`), durum DEĞİŞTİRMEZ — yalnızca iz bırakır.
   * `metadata.tier` eşiği taşır; aynı eşik ikinci kez yazılmaz.
   */
  | "OVERDUE"
  /**
   * Alma saati gecmis valiz icin misafire hatirlatma gonderildi
   * (`OverdueGuestReminderService`). `metadata.slot` 1..7; ayni slot ikinci kez yazilmaz.
   */
  | "OVERDUE_GUEST_REMINDER"
  /**
   * Gec birakma hatirlatmasi sahiplenildi (`LateDropoffService`). `metadata.stage` 1..3,
   * `metadata.checkInTime` hangi birakma saatine ait oldugu (saat degisirse sayac sifirlanir).
   */
  | "LATE_DROPOFF_REMINDER"
  /** Esnaf/yonetici "Misafiri bekle": `metadata.until` yeni kapanis ani. */
  | "LATE_HOLD";

/** Wallet kartinin gosterdigi bir seyi (saat, valiz, durum) degistiren olaylar. */
const WALLET_EVENTS: ReadonlySet<BookingEventType> = new Set([
  "PAID",
  "APPROVED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "MODIFIED",
  "BAGS_MODIFIED",
]);

export class BookingEventService {
  async record(params: {
    bookingId: string;
    event: BookingEventType;
    actorId?: string | null;
    actorRole?: Role | null;
    /**
     * Yazma bir yonetici "kullanici olarak goruntule" oturumunda yapildiysa o
     * yoneticinin id'si. `actorId` goruntulenen kullanicidir (yetki onun);
     * bu alan olmadan defter "esnaf tahsil etti" der, oysa dugmeye yonetici
     * basmistir. Nakit anlasmazliginda ilk bakilan satir bu.
     */
    impersonatedBy?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const metadata = {
      ...(params.metadata ?? {}),
      ...(params.impersonatedBy ? { impersonatedBy: params.impersonatedBy } : {}),
    };
    await prisma.bookingEvent.create({
      data: {
        bookingId: params.bookingId,
        event: params.event,
        actorId: params.actorId ?? null,
        actorRole: params.actorRole ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    // Her gecis buradan geciyor; kart guncellemesi ayri ayri servislere yazilmaz.
    if (WALLET_EVENTS.has(params.event)) {
      void walletPassService.notifyBookingChanged(params.bookingId).catch((err) => {
        logger.warn({ err, bookingId: params.bookingId }, "wallet_pass_update_failed");
      });
    }
  }

  async getByBookingId(bookingId: string) {
    return prisma.bookingEvent.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" },
    });
  }
}

export const bookingEventService = new BookingEventService();
