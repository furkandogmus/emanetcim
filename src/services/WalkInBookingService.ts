import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { assertShopAccess, type ShopRelation } from "@/lib/shop-access";
import { claimOnce, rateLimit } from "@/lib/rate-limit";
import { getPricingRules } from "@/lib/platform-settings";
import { moneyToNumber } from "@/lib/money";
import { computeAuthoritativeCheckoutTotals } from "@/lib/booking-server-price";
import { getLegalDocumentVersion, LEGAL_DOC_PRIVACY, LEGAL_DOC_TERMS } from "@/lib/legal-versions";
import { bookingShortCode } from "@/lib/booking-code";
import { walkInInputSchema } from "@/lib/walk-in-input";
import { signGuestManageLinkToken } from "@/lib/guest-lookup-token";
import { getSiteBaseUrl } from "@/lib/site-base-url";
import { createWalkInBooking } from "@/services/booking/create";
import { BookingRejectedError, type BookingRejectionCode } from "@/services/booking/errors";
import { bookingService } from "@/services/BookingService";
import { notificationService } from "@/services/NotificationService";

/**
 * Kapidan gelen misafir (Bounce Kiosk karsiligi): uygulamasi/hesabi olmayan gezgin icin
 * dukkan operatoru (sahip, personel, yonetici: `operate`) tezgahta rezervasyon acar ve
 * valizi hemen teslim alir. Web action'i ve mobil uc YALNIZ bunu cagirir.
 *
 * Hesap: olusturulmaz. Rezervasyon hesapsizdir (`guestId = null`); e-posta verildiyse
 * yonetim bagi gider ve misafir o e-postayi dogrulayan bir hesap acinca rezervasyon
 * kendiliginden baglanir (`linkGuestBookingsToVerifiedUser`). Operatorun yazdigi adrese
 * sessizce hesap acmak, baskasinin adresini sahiplendirmek olurdu.
 *
 * KVKK/sartlar: misafir hesapsiz oldugu icin `LegalAcceptance` (userId ister) yazilamaz;
 * operatorun "misafir sartlari kabul etti" beyani, metin surumleriyle CREATED olayina girer.
 */

/** Operator basina: bir tezgahta 10 dakikada 10'dan fazla kapidan misafir olagan degil. */
export const WALK_IN_OPERATOR_LIMIT = { max: 10, windowMs: 10 * 60 * 1000 };
/** Dukkan basina: birden cok personel ayni dukkani sisiremesin. */
export const WALK_IN_SHOP_LIMIT = { max: 30, windowMs: 60 * 60 * 1000 };
/**
 * Operatorun yazdigi adrese gun boyu e-posta: bir adres baskasina spam hedefi olmasin.
 * Asilinca rezervasyon yine acilir, yalniz e-posta atlanir (yanit ayni bicimde, QR ekranda).
 */
export const WALK_IN_EMAIL_LIMIT = { max: 3, windowMs: 24 * 60 * 60 * 1000 };
/** Hesaba baglanmamis walk-in satirinda iletisim ve ad bu kadar gun sonra silinir. */
export const WALK_IN_CONTACT_RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;


export type WalkInActor = {
  id: string;
  role: "GUEST" | "PARTNER" | "ADMIN";
  impersonatedBy?: string | null;
};

export type WalkInErrorCode =
  | "INVALID_INPUT"
  | "IN_PROGRESS"
  | "TERMS_REQUIRED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "SHOP_NOT_OPERATING"
  | "RATE_LIMITED"
  | "TOO_MANY_BAGS"
  | BookingRejectionCode;

export type WalkInSuccess = {
  ok: true;
  bookingId: string;
  shortCode: string;
  qrCodeToken: string | null;
  totalPrice: number;
  checkInTime: string;
  checkOutTime: string;
  /** Teslim alma da yapildi (`CHECKED_IN`). */
  checkedIn: boolean;
  /**
   * Teslim almayi normal check-in ekrani tamamlamali: muhur zorunlu ya da check-in reddedildi.
   * Rezervasyon `APPROVED` kalir; istemci o ekrani bu kimlikle acar.
   */
  needsCheckIn: boolean;
  checkInErrorCode: string | null;
  /** Onay e-postasi kuyruga alindi; yoksa misafir QR'i/kodu ekrandan fotografa ceker. */
  emailQueued: boolean;
};

export type WalkInResult = WalkInSuccess | { ok: false; code: WalkInErrorCode };

function phoneDigits(raw: string | undefined): string | null {
  if (!raw) return null;
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? `${plus ? "+" : ""}${digits}` : null;
}

export class WalkInBookingService {
  async create(actor: WalkInActor, raw: unknown, opts: { locale?: string | null; now?: Date } = {}): Promise<WalkInResult> {
    const parsed = walkInInputSchema.safeParse(raw);
    if (!parsed.success) {
      const termsMissing = parsed.error.issues.some((i) => i.path[0] === "termsConfirmed");
      return { ok: false, code: termsMissing ? "TERMS_REQUIRED" : "INVALID_INPUT" };
    }
    const input = parsed.data;

    const access = await assertShopAccess(actor, input.shopId, "operate");
    if (!access.ok) return { ok: false, code: access.code };

    /*
      Tekrar: ayni form gonderimi (istemci anahtari) ikinci rezervasyon acmaz. Hesapsiz
      satirda `(guestId, idempotencyKey)` benzersizligi NULL yuzunden tutmaz; esanli iki
      istegi `claimOnce` ayirir, kayitli olan aranip aynen doner.
    */
    const key = input.idempotencyKey;
    if (key) {
      const existing = await findWalkInReplay(input.shopId, key);
      if (existing) return existing;
      if (!(await claimOnce(`walkin_idem:${input.shopId}:${key}`, 10 * 60 * 1000))) {
        return (await findWalkInReplay(input.shopId, key)) ?? { ok: false, code: "IN_PROGRESS" };
      }
    }

    // Sira: yetkisiz istek sayaci tuketmesin, ama sinir dukkan/kapasite okumasindan once.
    const opOk = await rateLimit(`walkin_op:${actor.id}`, WALK_IN_OPERATOR_LIMIT.max, WALK_IN_OPERATOR_LIMIT.windowMs);
    const shopOk = opOk && (await rateLimit(`walkin_shop:${input.shopId}`, WALK_IN_SHOP_LIMIT.max, WALK_IN_SHOP_LIMIT.windowMs));
    if (!opOk || !shopOk) return { ok: false, code: "RATE_LIMITED" };

    const shop = await prisma.shop.findUnique({
      where: { id: input.shopId },
      select: { id: true, isActive: true, isPrelaunch: true, pricePerDay: true },
    });
    if (!shop) return { ok: false, code: "NOT_FOUND" };
    if (!shop.isActive || shop.isPrelaunch) return { ok: false, code: "SHOP_NOT_OPERATING" };

    const rules = await getPricingRules();
    if (input.bagCount > rules.maxBagsPerSlot) return { ok: false, code: "TOO_MANY_BAGS" };

    const now = opts.now ?? new Date();
    const pickupAt = new Date(input.pickupAt);
    // Walk-in "simdi" baslar; tek boy fiyat oldugu icin valizler M sayilir.
    const totals = computeAuthoritativeCheckoutTotals(
      moneyToNumber(shop.pricePerDay),
      0,
      input.bagCount,
      0,
      now,
      pickupAt,
      rules,
    );
    const guestEmail = input.guestEmail ?? null;
    const guestPhone = phoneDigits(input.guestPhone);
    const locale = opts.locale ?? null;

    let booking;
    try {
      booking = await createWalkInBooking(
        {
          shopId: shop.id,
          totalPrice: totals.subtotalBeforeCoupon,
          unitPrice: totals.unitPrice,
          insuranceFee: totals.insuranceFee,
          bagCountS: totals.bagCountS,
          bagCountM: totals.bagCountM,
          bagCountXl: totals.bagCountXl,
          checkInTime: now,
          checkOutTime: pickupAt,
          locale,
          idempotencyKey: key,
        },
        {
          operator: { id: actor.id, role: actor.role },
          guestName: input.guestName,
          guestEmail,
          guestPhone,
          eventMetadata: walkInEventMetadata(access.relation, actor, now, {
            email: !!guestEmail,
            phone: !!guestPhone,
          }),
        },
      );
    } catch (e) {
      if (e instanceof BookingRejectedError) return { ok: false, code: e.code };
      throw e;
    }

    let checkedIn = false;
    let checkInErrorCode: string | null = null;
    if (!rules.requireSealsOnCheckIn) {
      const r = await bookingService.checkIn(booking.id, undefined, {
        id: actor.id,
        role: actor.role,
        impersonatedBy: actor.impersonatedBy ?? null,
      });
      checkedIn = r.ok;
      if (!r.ok) {
        checkInErrorCode = r.code;
        logger.warn({ bookingId: booking.id, code: r.code }, "walk_in_check_in_failed");
      }
    }

    let emailQueued = false;
    if (
      guestEmail &&
      (await rateLimit(`walkin_email:${guestEmail}`, WALK_IN_EMAIL_LIMIT.max, WALK_IN_EMAIL_LIMIT.windowMs))
    ) {
      emailQueued = true;
      void sendWalkInConfirmation(booking.id, guestEmail, totals.subtotalBeforeCoupon, pickupAt, locale ?? "tr", now).catch(
        (err) => logger.error({ err, bookingId: booking.id }, "walk_in_confirmation_failed"),
      );
    }

    return {
      ok: true,
      bookingId: booking.id,
      shortCode: bookingShortCode(booking.id),
      qrCodeToken: booking.qrCodeToken,
      totalPrice: totals.subtotalBeforeCoupon,
      checkInTime: booking.checkInTime.toISOString(),
      checkOutTime: booking.checkOutTime.toISOString(),
      checkedIn,
      needsCheckIn: !checkedIn,
      checkInErrorCode,
      emailQueued,
    };
  }

  /**
   * Saklama (KVKK): hesaba hic baglanmamis walk-in satirinda ad, e-posta ve telefon teslimden
   * (yoksa planli alma saatinden) 180 gun sonra bosaltilir. Rezervasyonun kendisi defter
   * icin kalir. `cleanup` isi gunde bir cagirir; doner: bosaltilan satir sayisi.
   */
  async purgeExpiredGuestContact(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - WALK_IN_CONTACT_RETENTION_DAYS * DAY_MS);
    const { count } = await prisma.booking.updateMany({
      where: {
        source: "walk_in",
        guestId: null,
        OR: [{ guestName: { not: null } }, { guestEmail: { not: null } }, { guestPhone: { not: null } }],
        AND: [{ OR: [{ checkedOutAt: { lt: cutoff } }, { checkedOutAt: null, checkOutTime: { lt: cutoff } }] }],
      },
      data: { guestName: null, guestEmail: null, guestPhone: null },
    });
    return count;
  }
}

async function findWalkInReplay(shopId: string, idempotencyKey: string): Promise<WalkInSuccess | null> {
  const b = await prisma.booking.findFirst({
    where: { shopId, source: "walk_in", idempotencyKey },
    select: { id: true, status: true, qrCodeToken: true, totalPrice: true, checkInTime: true, checkOutTime: true },
  });
  if (!b) return null;
  const checkedIn = b.status === "CHECKED_IN" || b.status === "CHECKED_OUT";
  return {
    ok: true,
    bookingId: b.id,
    shortCode: bookingShortCode(b.id),
    qrCodeToken: b.qrCodeToken,
    totalPrice: moneyToNumber(b.totalPrice),
    checkInTime: b.checkInTime.toISOString(),
    checkOutTime: b.checkOutTime.toISOString(),
    checkedIn,
    needsCheckIn: b.status === "APPROVED",
    checkInErrorCode: null,
    // Tekrar e-posta gondermez; ilk istek gonderdiyse misafirde zaten var.
    emailQueued: false,
  };
}

/** Olay satirina kisisel veri girmez: yalniz hangi iletisim kanalinin verildigi. */
export function walkInEventMetadata(
  relation: ShopRelation,
  actor: WalkInActor,
  now: Date,
  contact: { email: boolean; phone: boolean },
): Record<string, unknown> {
  return {
    channel: "walk_in",
    operatorRelation: relation,
    ...(actor.impersonatedBy ? { impersonatedBy: actor.impersonatedBy } : {}),
    contact,
    consent: {
      confirmedByOperator: true,
      at: now.toISOString(),
      [LEGAL_DOC_TERMS]: getLegalDocumentVersion(LEGAL_DOC_TERMS),
      [LEGAL_DOC_PRIVACY]: getLegalDocumentVersion(LEGAL_DOC_PRIVACY),
    },
  };
}

async function sendWalkInConfirmation(
  bookingId: string,
  email: string,
  total: number,
  checkOutTime: Date,
  locale: string,
  now: Date,
): Promise<void> {
  const token = await signGuestManageLinkToken({ bookingId, email, checkOutTime, now });
  await notificationService.notifyWalkInBookingCreated({
    email,
    bookingId,
    totalPrice: total,
    locale,
    manageUrl: `${getSiteBaseUrl()}/${locale}/bookings/manage/${token}`,
  });
}

export const walkInBookingService = new WalkInBookingService();
