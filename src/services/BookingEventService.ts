import prisma from "@/lib/db";
import type { Role } from "@prisma/client";

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
  | "BAGS_MODIFIED";

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
        metadata: (params.metadata as any) ?? {},
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
