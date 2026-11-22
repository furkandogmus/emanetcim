/**
 * Iptal edilmis rezervasyonlara `CANCELLED` olayindaki nedeni ekler (salt okuma).
 * Neden `Booking`te degil olay defterinde durur (migrasyon yok); liste uclari
 * N+1 yerine tek sorgu atar.
 */
import prisma from '@/lib/db';
import { cancelReasonFromEvents, type CancelReason } from '@/lib/booking-closure';

export async function withCancelReasons<T extends { id: string; status: string }>(
  rows: T[],
): Promise<Array<T & { cancelReason: CancelReason | null }>> {
  const ids = rows.filter((r) => r.status === 'CANCELLED').map((r) => r.id);
  const byBooking = new Map<string, Array<{ event: string; metadata: unknown; createdAt: Date }>>();
  if (ids.length > 0) {
    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: { in: ids }, event: 'CANCELLED' },
      select: { bookingId: true, event: true, metadata: true, createdAt: true },
    });
    for (const e of events) {
      const list = byBooking.get(e.bookingId) ?? [];
      list.push(e);
      byBooking.set(e.bookingId, list);
    }
  }
  return rows.map((r) => ({ ...r, cancelReason: cancelReasonFromEvents(byBooking.get(r.id) ?? []) }));
}

export async function withCancelReason<T extends { id: string; status: string }>(
  row: T,
): Promise<T & { cancelReason: CancelReason | null }> {
  const [out] = await withCancelReasons([row]);
  return out;
}
