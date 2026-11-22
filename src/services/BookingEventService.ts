import prisma from "@/lib/db";
import type { Role, Prisma } from "@prisma/client";

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
  | "OVERDUE_GUEST_REMINDER";

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
  }

  async getByBookingId(bookingId: string) {
    return prisma.bookingEvent.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" },
    });
  }
}

export const bookingEventService = new BookingEventService();
