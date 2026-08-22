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
  | "OVERDUE";

export class BookingEventService {
  async record(params: {
    bookingId: string;
    event: BookingEventType;
    actorId?: string | null;
    actorRole?: Role | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await prisma.bookingEvent.create({
      data: {
        bookingId: params.bookingId,
        event: params.event,
        actorId: params.actorId ?? null,
        actorRole: params.actorRole ?? null,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
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
