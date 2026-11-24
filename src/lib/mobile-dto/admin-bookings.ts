import { toWhatsAppNumber } from "@/lib/whatsapp";
import { cancelReasonFromEvents, noShowAvailableAt } from "@/lib/booking-closure";
import type { AdminOps } from "./internal";
import { canViewAs } from "./admin-users";
import { fullAddress } from "./address";
import { toMobileBookingSummary } from "./booking";

type AdminBookingRowSource = Awaited<ReturnType<AdminOps["listBookings"]>>[number];

type AdminBookingDetailSource = NonNullable<Awaited<ReturnType<AdminOps["bookingDetail"]>>>;

/** `admin/bookings` satiri: ozet + misafir adi (yoksa e-posta) ve olusturulma ani. */
export function toMobileAdminBookingRow(b: AdminBookingRowSource & { cancelReason?: string | null }) {
  return {
    ...toMobileBookingSummary(b),
    guestName: b.guest?.name || b.guest?.email || b.guestEmail || "",
    createdAt: b.createdAt.toISOString(),
  };
}

/** `admin/bookings/[id]`: destek hattinda gereken her sey; QR token'i TASIMAZ. */
export function toMobileAdminBookingDetail({ booking: b, events }: AdminBookingDetailSource) {
  const place = fullAddress(b.shop.address, b.shop.district, b.shop.city);
  return {
    ...toMobileAdminBookingRow({ ...b, cancelReason: b.status === "CANCELLED" ? cancelReasonFromEvents(events) : null }),
    noShowAvailableAt: noShowAvailableAt(b)?.toISOString() ?? null,
    guest: {
      // Kayitli kullanici degilse (misafir e-postasiyla alinmis) kimlik yok: "bu kullanici olarak gir" cizilmez.
      id: b.guest?.id ?? null,
      name: b.guest?.name ?? "",
      email: b.guest?.email ?? b.guestEmail ?? "",
      phone: b.guest?.phone ?? b.guestPhone ?? "",
      whatsapp: toWhatsAppNumber(b.guest?.phone ?? b.guestPhone),
      // Sunucu ADMIN ve yasakli hesaba girisi reddeder; dugme hic cizilmesin.
      canViewAs: b.guest ? canViewAs(b.guest) : false,
    },
    shop: {
      id: b.shopId,
      ownerId: b.shop.owner.id,
      name: b.shop.name,
      address: place,
      phone: b.shop.owner.phone ?? "",
      whatsapp: toWhatsAppNumber(b.shop.owner.phone),
      ownerName: b.shop.owner.name ?? "",
      canViewAsOwner: canViewAs(b.shop.owner),
      latitude: b.shop.latitude,
      longitude: b.shop.longitude,
    },
    seals: b.seals,
    checkedInAt: b.checkedInAt?.toISOString() ?? null,
    checkedOutAt: b.checkedOutAt?.toISOString() ?? null,
    couponCode: b.couponCode,
    disputeStatus: b.dispute?.status ?? null,
    // Itiraz ekrani (`admin/dispute/[id]`) itiraz kimligiyle acilir.
    disputeId: b.dispute?.id ?? null,
    paymentStatus: b.paymentLog?.status ?? null,
    events: events.map((e) => ({ event: e.event, actorRole: e.actorRole, createdAt: e.createdAt.toISOString() })),
  };
}

type AdminBookingNotificationSource = NonNullable<Awaited<ReturnType<AdminOps["bookingNotifications"]>>>[number];

/** Saglayici hata metni uzun olabilir; mobilde ozet yeter. */
const NOTIFICATION_ERROR_MAX = 300;

/** `admin/bookings/[id]/notifications` satiri: tur, alici, durum, hata ozeti. */
export function toMobileAdminBookingNotification(n: AdminBookingNotificationSource) {
  return {
    id: n.id,
    type: n.type,
    recipient: n.recipient,
    status: n.status,
    error: n.error && n.error.length > NOTIFICATION_ERROR_MAX ? `${n.error.slice(0, NOTIFICATION_ERROR_MAX)}…` : n.error,
    createdAt: n.createdAt.toISOString(),
  };
}
