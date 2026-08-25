"use server";

import { bookingService } from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";
import prisma from "@/lib/db";
import { revalidatePathAllLocales } from "@/lib/revalidate-locales";
import { verifyQrToken } from "@/lib/qr-token";
import { normalizeTrGsm10 } from "@/lib/netgsm";
import { getLocale } from "next-intl/server";
import { sealService } from "@/services/SealService";
import { z } from "zod";
import { parseCheckInSeals } from "@/lib/seal-payload";
import { bookingNotificationEmail } from "@/services/booking/guest-contact";
import { requirePartner, assertPartner } from "@/lib/action-auth";

function revalidatePartnerPaths() {
  revalidatePathAllLocales("/partner");
  revalidatePathAllLocales("/partner/bookings");
  revalidatePathAllLocales("/partner/settings");
}

/**
 * Check-in / check-out sonuç KODLARININ çeviri anahtarı karşılıkları.
 *
 * NEDEN VAR (2026-08-25): iki action da servisin dönüş metnini olduğu gibi
 * geçiriyordu. O metin TÜRKÇE bir cümledir ("Rezervasyon bulunamadı.") ve
 * `PartnerClient` / `CheckInDialog` onu ekrana aynen basıyordu — yani Japonca
 * veya Farsça arayüzdeki bir esnaf Türkçe hata okuyordu. Kod zaten dönüyordu;
 * eksik olan tek şey eşlemeydi.
 *
 * Sayı taşıyan iki mesajda ("3 valiz için 2 mühür girildi") sayılar kayboldu:
 * sonuç nesnesi onları ayrı alan olarak taşımıyor. Karşılık metinleri sayıya
 * ihtiyaç duymayacak şekilde yazıldı; sayılar zaten esnafın önündeki formda.
 */
/**
 * HER esnaf işleminde ortak olan sonuç kodları.
 *
 * Dört ayrı tablo (`CHECKIN`, `CHECKOUT`, `REVIEW`, `BAG_REVISION`) bu dört satırı
 * kelimesi kelimesine tekrarlıyordu. Bir eşlemeyi düzeltmek diğer üçünü sessizce
 * geride bırakıyordu; taban artık tek yerde, her tablo yalnızca KENDİ farkını yazar.
 */
const COMMON_CODE_TO_KEY = {
  NOT_FOUND: "Errors.bookingNotFound",
  FORBIDDEN: "Errors.unauthorized",
  INVALID_STATUS: "Errors.bookingStateConflict",
  UNKNOWN: "Errors.generic",
} as const;

/** Sonuç kodunu kullanıcıya gösterilebilir çeviri anahtarına çevirir. */
function toErrorKey(map: Record<string, string>, code: string): string {
  return map[code] ?? COMMON_CODE_TO_KEY.UNKNOWN;
}

const CHECKIN_CODE_TO_KEY: Record<string, string> = {
  ...COMMON_CODE_TO_KEY,
  SHOP_CLOSED: "Errors.checkInShopClosed",
  SEAL_REQUIRED: "Errors.sealNumbersRequired",
  SEAL_COUNT_MISMATCH: "Errors.sealCountMismatch",
  PAYMENT_REQUIRED: "Errors.checkInPaymentFailed",
  SEAL_INVALID: "Errors.sealInvalid",
  FAULTY_OVERLAPS_ASSIGNMENT: "Errors.sealFaultyOverlaps",
  SEAL_FAULTY_INVALID: "Errors.sealFaultyInvalid",
  SEAL_NOT_ASSIGNED: "Errors.sealNotAssigned",
};

/** Check-out'un servisten dönen tek ekstra kodu yok; taban yeter. */
const CHECKOUT_CODE_TO_KEY: Record<string, string> = COMMON_CODE_TO_KEY;

/** Onay ve red aynı sonuç tipini döndürür; ikisi de tabanla karşılanır. */
const REVIEW_CODE_TO_KEY: Record<string, string> = COMMON_CODE_TO_KEY;

const BAG_REVISION_CODE_TO_KEY: Record<string, string> = {
  ...COMMON_CODE_TO_KEY,
  INVALID_COUNTS: "Errors.invalidData",
  NO_PENDING_REVISION: "Errors.invalidData",
};

/**
 * QR / ham id ile rezervasyon önizlemesi (esnaf paneli).
 */
export async function getPartnerBookingPreviewAction(raw: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  let bookingId = raw.trim();
  const payload = await verifyQrToken(bookingId);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guest: true, shop: true },
  });

  if (!booking) {
    return { success: false as const, error: "Errors.bookingNotFound" };
  }

  if (
    auth.actor.role === "PARTNER" &&
    booking.shop.ownerId !== auth.actor.id
  ) {
    return {
      success: false as const,
      error: "Errors.unauthorized",
    };
  }

  const total = booking.bagCountS + booking.bagCountM + booking.bagCountXl;
  const bagsLabel = `${total} valiz · S:${booking.bagCountS} M:${booking.bagCountM} XL:${booking.bagCountXl}`;

  return {
    success: true as const,
    bookingId: booking.id,
    guestName: booking.guest?.name || "Misafir",
    bagsLabel,
    bagCountS: booking.bagCountS,
    bagCountM: booking.bagCountM,
    bagCountXl: booking.bagCountXl,
    totalBags: total,
    status: booking.status,
    pendingBagRevision: booking.pendingBagRevision,
  };
}

/**
 * Check-out öncesi rezervasyona bağlı mühür listesi (onay ekranı).
 */
export async function getPartnerBookingSealsAction(bookingIdRaw: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  let bookingId = bookingIdRaw.trim();
  const payload = await verifyQrToken(bookingIdRaw);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true },
  });
  if (!booking) {
    return { success: false as const, error: "Errors.bookingNotFound" };
  }
  if (booking.shop.ownerId !== auth.actor.id && auth.actor.role !== "ADMIN") {
    return { success: false as const, error: "Errors.unauthorized" };
  }

  const seals = await prisma.bookingSeal.findMany({
    where: { bookingId },
    orderBy: { bagIndex: "asc" },
    select: {
      sealNumber: true,
      bagIndex: true,
      bagSize: true,
    },
  });

  return {
    success: true as const,
    bookingId,
    seals: seals.map((s) => ({
      sealNumber: s.sealNumber,
      bagIndex: s.bagIndex,
      bagSize: s.bagSize,
    })),
  };
}

/**
 * checkInAction - QR JWT veya ham token / booking id ile check-in.
 *
 * `seals` İSTEĞE BAĞLI ama akışın kalbi: verilmezse `BookingSeal` boş kalır ve
 * anlaşmazlıkta "bu valizi mühürlü teslim aldık" iddiası kanıtsız kalır. Platform
 * ayarı `requireSealsOnCheckIn` açıkken `BookingService` mühürsüz check-in'i
 * reddeder (P1-23).
 */
export async function checkInAction(
  qrTokenOrBookingId: string,
  seals?: unknown,
) {
  const actor = await assertPartner();

  let bookingId = qrTokenOrBookingId.trim();
  const payload = await verifyQrToken(qrTokenOrBookingId);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true, guest: { select: { email: true } } },
  });
  if (!booking) {
    return {
      success: false as const,
      error: "Errors.bookingNotFound",
      code: "NOT_FOUND" as const,
    };
  }

  if (actor.role === "PARTNER" && booking.shop.ownerId !== actor.id) {
    return {
      success: false as const,
      error: "Errors.unauthorized",
      code: "FORBIDDEN" as const,
    };
  }

  const parsedSeals = parseCheckInSeals(seals);
  if (!parsedSeals.ok) {
    return {
      success: false as const,
      error: "Errors.invalidInput",
      code: "SEAL_INVALID" as const,
    };
  }
  const sealPayload = parsedSeals.value;

  // Aktör kim: dükkanda tahsilat modunda check-in aynı zamanda "parayı aldım"
  // beyanıdır ve bu denetim izine yazılır (P1-9).
  const result = await bookingService.checkIn(bookingId, sealPayload, {
    id: actor.id,
    role: actor.role,
  });

  if (result.ok) {
    /*
      Alici kurali SERVISTE: web `booking.guest?.email`, mobil ise
      `booking.guestEmail` bakiyordu — biri hesapli, digeri hesapsiz misafiri
      atliyordu. `bookingNotificationEmail` ikisini de kapsar.
    */
    const recipient = bookingNotificationEmail(booking);
    if (recipient) {
      const locale = await getLocale();
      await notificationService.notifyCheckIn(recipient, booking.id, locale);
    }

    revalidatePartnerPaths();
    return { success: true as const };
  }

  return {
    success: false as const,
    error: toErrorKey(CHECKIN_CODE_TO_KEY, result.code),
    code: result.code,
  };
}

/**
 * checkOutAction - Esnafın valizi müşteriye teslim ettiği adım.
 */
export async function checkOutAction(qrTokenOrBookingId: string) {
  const actor = await assertPartner();

  let bookingId = qrTokenOrBookingId.trim();
  const payload = await verifyQrToken(qrTokenOrBookingId);
  if (payload) bookingId = payload.bookingId;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { shop: true, guest: { select: { email: true } } },
  });
  if (!booking) {
    return {
      success: false as const,
      error: "Errors.bookingNotFound",
      code: "NOT_FOUND" as const,
    };
  }
  if (actor.role === "PARTNER" && booking.shop.ownerId !== actor.id) {
    return {
      success: false as const,
      error: "Errors.unauthorized",
      code: "FORBIDDEN" as const,
    };
  }

  const result = await bookingService.checkOut(bookingId);

  if (result.ok) {
    const recipient = bookingNotificationEmail(booking);
    if (recipient) {
      const locale = await getLocale();
      await notificationService.notifyCheckOut(recipient, booking.id, locale);
    }

    revalidatePartnerPaths();
    return { success: true as const };
  }

  return {
    success: false as const,
    error: toErrorKey(CHECKOUT_CODE_TO_KEY, result.code),
    code: result.code,
  };
}

/**
 * Esnaf / admin hesabına GSM (Netgsm bildirimleri için). Misafirlere SMS gönderilmez.
 */
export async function updatePartnerPhoneAction(phone: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const trimmed = phone.trim();
  const normalized = normalizeTrGsm10(trimmed);
  if (trimmed && !normalized) {
    return {
      success: false as const,
      error: "Errors.invalidTrPhone",
    };
  }

  try {
    await prisma.user.update({
      where: { id: auth.actor.id },
      data: { phone: normalized },
    });
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? (e as { code?: string }).code
        : undefined;
    if (code === "P2002") {
      return {
        success: false as const,
        error: "Errors.phoneAlreadyRegistered",
      };
    }
    throw e;
  }

  revalidatePartnerPaths();
  return { success: true as const };
}

/**
 * Rezervasyon talebini onayla.
 *
 * Govde `BookingService.approveBooking`'de: mobil uc de AYNI cagriyi yapar.
 * Burada kalan tek is oturum cozumu, bildirim dili ve `revalidate`.
 */
export async function approveBookingAction(bookingId: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const result = await bookingService.approveBooking(
    bookingId,
    { id: auth.actor.id, role: auth.actor.role },
    { locale: await getLocale() },
  );

  if (!result.ok) {
    return { success: false as const, error: toErrorKey(REVIEW_CODE_TO_KEY, result.code) };
  }

  revalidatePartnerPaths();
  return { success: true as const };
}

/**
 * Rezervasyon talebini reddet (admin icin: iptal et).
 *
 * Iade, kapasite serbest birakma ve sadakat puani geri alma `cancelBooking`'de —
 * bu action onu KENDI BASINA tekrar etmez.
 */
export async function rejectBookingAction(bookingId: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const result = await bookingService.rejectBooking(
    bookingId,
    { id: auth.actor.id, role: auth.actor.role },
    { locale: await getLocale() },
  );

  if (!result.ok) {
    return { success: false as const, error: toErrorKey(REVIEW_CODE_TO_KEY, result.code) };
  }

  revalidatePartnerPaths();
  return { success: true as const };
}

/**
 * Sıradaki uygun mühürleri getirir (Otomatik mühürleme için).
 */
export async function getNextAvailableSealsAction(shopId: string, count: number) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  // Sahiplik kontrolü: esnaf sadece kendi dükkanının mühürlerini görebilir
  if (auth.actor.role === "PARTNER") {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { ownerId: true },
    });
    if (!shop || shop.ownerId !== auth.actor.id) {
      return { success: false as const, error: "Errors.unauthorized" };
    }
  }

  const seals = await sealService.getNextAvailableSeals(shopId, count);
  return {
    success: true as const,
    seals: seals.map(s => ({ sealNumber: s.serialNumber })),
  };
}

/**
 * Bir mührü hatalı olarak işaretler ve stoktan düşer.
 */
export async function reportFaultySealAction(serialNumber: number, shopId: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  try {
    await sealService.markSealAsFaulty(serialNumber, shopId);
    return { success: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errors.generic";
    return { success: false as const, error: msg };
  }
}

/**
 * `extraAmount` BİLEREK YOK.
 *
 * Eskiden istemciden alınıyordu, yani esnaf misafire gösterilecek ek ücreti
 * kendisi yazabiliyordu ve sunucu hiç doğrulamıyordu. Fark artık sunucuda,
 * `computeAuthoritativeCheckoutTotals` ile hesaplanıyor — istemciden gelen tutar
 * varsa yok sayılır (P1-8).
 */
const pendingBagRevisionBodySchema = z.object({
  bookingId: z.string().uuid(),
  bagCountS: z.number().int().min(0).max(500),
  bagCountM: z.number().int().min(0).max(500),
  bagCountXl: z.number().int().min(0).max(500),
});

/**
 * Gerçek valiz sayısı / boyutu rezervasyondan farklıysa ÖNERİ kaydı açar.
 * Gövde `BookingService.proposeBagRevision`'da; mobil uç da aynı gövdeyi kullanır.
 */
export async function setPendingBagRevisionAction(raw: unknown) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const parsed = pendingBagRevisionBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: "Errors.invalidData" };
  }
  const { bookingId, ...counts } = parsed.data;

  const result = await bookingService.proposeBagRevision(bookingId, counts, auth.actor);
  if (!result.ok) {
    return {
      success: false as const,
      error: toErrorKey(BAG_REVISION_CODE_TO_KEY, result.code),
    };
  }

  revalidatePartnerPaths();
  return { success: true as const, extraAmount: result.extraAmount };
}

/**
 * Revizyonu UYGULAR: yeni valiz sayılarını ve yeniden hesaplanan toplamı yazar.
 *
 * NEDEN VAR (P1-8): eskiden yalnızca "temizle" vardı ve o revizyonu **siliyordu** —
 * valiz sayıları ve `totalPrice` hiç güncellenmiyordu. Yani bavul fiziksel olarak
 * teslim alınıyor, kayıt eski hâlinde kalıyordu. Prod'da izi var: `S1 M3 XL1 → 540.00`,
 * oysa aynı kurallarla 640 olmalıydı — 100 TRY eksik.
 */
export async function applyPendingBagRevisionAction(bookingId: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const result = await bookingService.applyBagRevision(bookingId, auth.actor, {
    source: "web",
  });
  if (!result.ok) {
    return {
      success: false as const,
      error: toErrorKey(BAG_REVISION_CODE_TO_KEY, result.code),
    };
  }

  revalidatePartnerPaths();
  return { success: true as const, newTotal: result.newTotal, delta: result.delta };
}

/**
 * Revizyonu REDDEDER: kaydı siler, rezervasyona DOKUNMAZ.
 *
 * Uygulamak için `applyPendingBagRevisionAction` kullanın. Bu ikisinin ayrı olması
 * bilinçli: eskiden tek bir "temizle" vardı ve o, uygulamak ile reddetmek arasında
 * ayrım yapmadan revizyonu yok ediyordu (P1-8).
 */
export async function clearPendingBagRevisionAction(bookingId: string) {
  const auth = await requirePartner();
  if (!auth.ok) return { success: false as const, error: auth.error };

  const result = await bookingService.clearBagRevision(bookingId, auth.actor);
  if (!result.ok) {
    return {
      success: false as const,
      error: toErrorKey(BAG_REVISION_CODE_TO_KEY, result.code),
    };
  }

  revalidatePartnerPaths();
  return { success: true as const };
}
