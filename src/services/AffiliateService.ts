/**
 * Araci (affiliate) programi -- kural ve yazma TEK yerde.
 *
 * NEDEN (2026-11-23): Airbnb ev sahipleri, oteller ve rehberler misafirlerini
 * zaten bize gonderiyor (cikis 11'de, ucus aksam). Onayli her araciya kisisel
 * bir link (`/r/<KOD>`) verilir; o linkten gelen rezervasyon TAMAMLANDIGINDA
 * (valiz birakildi ve teslim alindi) araci komisyon kazanir. Odeme ELLE
 * yapilir (ayda bir); sistem yalnizca borcu izler ve raporlar.
 *
 * Kullanici davet kodundan (`ReferralService`) AYRI: o tek seferlik misafir
 * indirimi, bu rezervasyon basina komisyon. Kod uretimi oradan alinir.
 *
 * Kurallar:
 *   - Atif yalnizca ACTIVE aracida yazilir; PENDING / PAUSED kod yok sayilir.
 *   - Aracinin kendi hesabi (ya da kendi iletisim e-postasi) ile yapilan
 *     rezervasyon atif ALMAZ: kendine komisyon yok.
 *   - Komisyon = misafirin odedigi toplam (araci indirimi sonrasi, gecikme
 *     ucreti haric) x rezervasyon anindaki oran / 100, 2 haneye yuvarlanir.
 *     Iptal / gelmedi / suresi dolan rezervasyon hic satir uretmez.
 *   - Araciya misafirin kisisel verisi GOSTERILMEZ: panel yalnizca tarih,
 *     dukkan ve tutar okur.
 */
import { AffiliateCommissionStatus, AffiliateStatus, AffiliateType, Prisma, type Role } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/db";
import logger from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit-log";
import { csvCell } from "@/lib/csv";
import { moneyToNumber } from "@/lib/money";
import { generateCode } from "@/services/ReferralService";
import { notificationService } from "@/services/NotificationService";
import type { TxClient } from "@/services/BookingService";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
type DecimalValue = Prisma.Decimal | number | string;

/** Link cerezi: son tiklama kazanir, 30 gun. */
export const AFFILIATE_COOKIE = "bp_aff";
export const AFFILIATE_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

/** `AHMET-EV`: 3-32 karakter, harf/rakam ve tek tire; tireyle baslamaz/bitmez. */
const CODE_PATTERN = /^[A-Z0-9](?:[A-Z0-9]|-(?!-)){1,30}[A-Z0-9]$/;

export const AFFILIATE_TYPES = ["airbnb_host", "hotel", "guide", "agency", "other"] as const;
export type AffiliateTypeKey = (typeof AFFILIATE_TYPES)[number];

const TYPE_TO_DB: Record<AffiliateTypeKey, AffiliateType> = {
  airbnb_host: AffiliateType.AIRBNB_HOST,
  hotel: AffiliateType.HOTEL,
  guide: AffiliateType.GUIDE,
  agency: AffiliateType.AGENCY,
  other: AffiliateType.OTHER,
};

export function affiliateTypeKey(t: AffiliateType): AffiliateTypeKey {
  return t.toLowerCase() as AffiliateTypeKey;
}

export const AFFILIATE_STATUSES = ["pending", "active", "paused"] as const;
export type AffiliateStatusKey = (typeof AFFILIATE_STATUSES)[number];

export function affiliateStatusKey(s: AffiliateStatus): AffiliateStatusKey {
  return s.toLowerCase() as AffiliateStatusKey;
}

/** Bosluk ve harf buyuklugu farki ayni kod sayilir. Gecersiz bicim `null`. */
export function normalizeAffiliateCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

const TR_FOLD: Record<string, string> = { Ç: "C", Ğ: "G", İ: "I", I: "I", Ö: "O", Ş: "S", Ü: "U" };

/** Addan okunur kod onerisi: "Ahmet'in Evi" -> `AHMETIN-EVI`. */
export function suggestAffiliateCode(displayName: string): string {
  const folded = displayName
    .toLocaleUpperCase("tr")
    .replace(/[ÇĞİIÖŞÜ]/g, (c) => TR_FOLD[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20)
    .replace(/-+$/g, "");
  return folded.length >= 3 ? folded : "ARACI";
}

/** Yuzde oranla indirim / komisyon: Decimal, 2 hane, yarim yukari. */
export function percentOf(base: DecimalValue, ratePct: DecimalValue): Decimal {
  return new Decimal(base).mul(new Decimal(ratePct)).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Araci misafir indirimi: ara toplamdan (sigorta dahil, kupon oncesi). */
export function applyAffiliateGuestDiscount(
  subtotal: number,
  ratePct: DecimalValue,
): { discountAmount: number; totalPrice: number } {
  const sub = new Decimal(subtotal);
  const discount = Decimal.min(percentOf(sub, ratePct), sub);
  return {
    discountAmount: discount.toNumber(),
    totalPrice: Decimal.max(0, sub.minus(discount)).toNumber(),
  };
}

/** Misafirin kimligi: hesapli ise `userId`, hesapsiz web odemesinde e-posta. */
export type AffiliateGuest = { userId?: string | null; guestEmail?: string | null; guestPhone?: string | null };

/** Telefon karsilastirma anahtari: son 10 rakam (`0532...` ile `+90532...` ayni). */
function phoneKey(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

export type AffiliateAttribution = {
  affiliateId: string;
  code: string;
  commissionRate: Decimal;
  guestDiscountRate: Decimal;
};

export type AffiliateResolution =
  | { ok: true; attribution: AffiliateAttribution }
  | { ok: false; reason: "invalid_code" | "own_code" };

export class AffiliateService {
  /**
   * Kod bu misafire atif verir mi? Onizleme, odeme ve rezervasyon ayni cevabi
   * buradan alir. Pasif / bekleyen araci ile bilinmeyen kod ayni cevabi verir
   * (`invalid_code`): durum bilgisi disari sizmaz.
   */
  async resolve(rawCode: unknown, guest: AffiliateGuest): Promise<AffiliateResolution> {
    const code = normalizeAffiliateCode(rawCode);
    if (!code) return { ok: false, reason: "invalid_code" };
    const affiliate = await prisma.affiliate.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        status: true,
        userId: true,
        contactEmail: true,
        contactPhone: true,
        commissionRate: true,
        guestDiscountRate: true,
        user: { select: { email: true } },
      },
    });
    if (!affiliate || affiliate.status !== AffiliateStatus.ACTIVE) return { ok: false, reason: "invalid_code" };

    // Kendine komisyon yok: aracinin hesabi, kendi e-postasi ya da telefonu.
    if (guest.userId && affiliate.userId && guest.userId === affiliate.userId) {
      return { ok: false, reason: "own_code" };
    }
    /*
      Girisli misafirde e-posta/telefon HESAPTAN okunur (QA, PR #207): tasiyici
      yalnizca `userId` veriyordu ve aracinin ikinci bir hesapla kendi kodunu
      kullanmasi e-posta karsilastirmasina hic girmiyordu.
    */
    const account = guest.userId
      ? await prisma.user.findUnique({ where: { id: guest.userId }, select: { email: true, phone: true } })
      : null;
    const emails = [guest.guestEmail, account?.email].map((e) => e?.trim().toLowerCase()).filter(Boolean);
    const ownEmails = [affiliate.contactEmail, affiliate.user?.email].map((e) => e?.trim().toLowerCase()).filter(Boolean);
    if (emails.some((e) => ownEmails.includes(e))) return { ok: false, reason: "own_code" };
    const phones = [guest.guestPhone, account?.phone].map(phoneKey).filter(Boolean);
    const ownPhone = phoneKey(affiliate.contactPhone);
    if (ownPhone && phones.includes(ownPhone)) return { ok: false, reason: "own_code" };
    return {
      ok: true,
      attribution: {
        affiliateId: affiliate.id,
        code: affiliate.code,
        commissionRate: new Decimal(affiliate.commissionRate),
        guestDiscountRate: new Decimal(affiliate.guestDiscountRate),
      },
    };
  }

  /**
   * `/r/<kod>` tiklamasi: kod ACTIVE ise gunluk sayaci bir artirir ve kodu
   * dondurur (cerez yazilsin diye). Kisi bilgisi tutulmaz.
   */
  async recordClick(rawCode: unknown, now = new Date(), opts: { count?: boolean } = {}): Promise<string | null> {
    const code = normalizeAffiliateCode(rawCode);
    if (!code) return null;
    const affiliate = await prisma.affiliate.findUnique({ where: { code }, select: { id: true, status: true } });
    if (!affiliate || affiliate.status !== AffiliateStatus.ACTIVE) return null;
    // Hiz siniri asildiysa tiklama sayilmaz ama atif cerezi yine yazilir.
    if (opts.count === false) return code;
    const day = new Date(`${istanbulDay(now)}T00:00:00.000Z`);
    try {
      await prisma.affiliateClickDay.upsert({
        where: { affiliateId_day: { affiliateId: affiliate.id, day } },
        create: { affiliateId: affiliate.id, day, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch (err) {
      // Sayac kaybi linki bozmamali.
      logger.warn({ err, affiliateId: affiliate.id }, "affiliate_click_count_failed");
    }
    return code;
  }

  /**
   * Check-out transaction'i icinde: tamamlanan rezervasyonun komisyon satiri.
   * Rezervasyon basina tek satir (`bookingId` benzersiz); tekrar cagri bir
   * sey yazmaz. Oran rezervasyonun KOPYASINDAN gelir, aracinin bugunku
   * oranindan degil.
   */
  async recordCommissionWithinTx(
    tx: TxClient,
    booking: {
      id: string;
      affiliateId: string | null;
      affiliateCommissionRate: DecimalValue | null;
      totalPrice: DecimalValue;
    },
    earnedAt: Date,
    opts: { refundAmount?: DecimalValue } = {},
  ): Promise<void> {
    if (!booking.affiliateId || booking.affiliateCommissionRate == null) return;
    const rate = new Decimal(booking.affiliateCommissionRate);
    // Erken teslim iadesi misafire geri verilen paradir: komisyon tabanindan duser.
    const base = Decimal.max(0, new Decimal(booking.totalPrice).minus(new Decimal(opts.refundAmount ?? 0)));
    await tx.affiliateCommission.createMany({
      data: [
        {
          affiliateId: booking.affiliateId,
          bookingId: booking.id,
          baseAmount: base,
          rate,
          amount: percentOf(base, rate),
          earnedAt,
        },
      ],
      skipDuplicates: true,
    });
  }

  /** Panel / admin sayaclari. Tutarlar Decimal toplanir, kenarda sayiya cevrilir. */
  async statsFor(ids: string[]): Promise<Map<string, AffiliateStats>> {
    const out = new Map<string, AffiliateStats>();
    for (const id of ids) out.set(id, emptyStats());
    if (ids.length === 0) return out;
    const [clicks, bookings, commissions] = await Promise.all([
      prisma.affiliateClickDay.groupBy({ by: ["affiliateId"], where: { affiliateId: { in: ids } }, _sum: { count: true } }),
      prisma.booking.groupBy({
        by: ["affiliateId", "status"],
        where: { affiliateId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.affiliateCommission.groupBy({
        by: ["affiliateId", "status"],
        where: { affiliateId: { in: ids } },
        _sum: { amount: true },
      }),
    ]);
    for (const c of clicks) out.get(c.affiliateId)!.clicks = c._sum.count ?? 0;
    for (const b of bookings) {
      if (!b.affiliateId) continue;
      const s = out.get(b.affiliateId)!;
      s.bookings += b._count._all;
      if (b.status === "CHECKED_OUT") s.completedBookings += b._count._all;
    }
    const sums = new Map<string, { unpaid: Decimal; paid: Decimal }>();
    for (const c of commissions) {
      const acc = sums.get(c.affiliateId) ?? { unpaid: new Decimal(0), paid: new Decimal(0) };
      const amount = new Decimal(c._sum.amount ?? 0);
      if (c.status === AffiliateCommissionStatus.PAID) acc.paid = acc.paid.plus(amount);
      else acc.unpaid = acc.unpaid.plus(amount);
      sums.set(c.affiliateId, acc);
    }
    for (const [id, acc] of sums) {
      const s = out.get(id)!;
      s.unpaid = acc.unpaid.toNumber();
      s.paid = acc.paid.toNumber();
      s.earned = acc.unpaid.plus(acc.paid).toNumber();
    }
    return out;
  }

  /**
   * Araci paneli (web, giris gerekli). Misafirin adi, e-postasi, telefonu ve
   * rezervasyon kodu SECILMEZ: yalnizca tarih, dukkan adi, tutar ve komisyon.
   */
  async getPanelForUser(userId: string) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { userId },
      select: {
        id: true,
        code: true,
        displayName: true,
        status: true,
        commissionRate: true,
        guestDiscountRate: true,
      },
    });
    if (!affiliate) return null;
    const [stats, recent] = await Promise.all([
      this.statsFor([affiliate.id]),
      prisma.booking.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          checkInTime: true,
          status: true,
          totalPrice: true,
          shop: { select: { name: true } },
          affiliateCommission: { select: { amount: true, status: true } },
        },
      }),
    ]);
    return {
      code: affiliate.code,
      displayName: affiliate.displayName,
      status: affiliateStatusKey(affiliate.status),
      commissionRate: moneyToNumber(affiliate.commissionRate),
      guestDiscountRate: moneyToNumber(affiliate.guestDiscountRate),
      stats: stats.get(affiliate.id)!,
      bookings: recent.map((b) => ({
        // Yalnizca GUN (Turkiye takvimi): saat misafirin hareketini ele verir.
        day: istanbulDay(b.checkInTime),
        shopName: b.shop.name,
        amount: moneyToNumber(b.totalPrice),
        completed: b.status === "CHECKED_OUT",
        cancelled: b.status === "CANCELLED",
        commission: b.affiliateCommission ? moneyToNumber(b.affiliateCommission.amount) : null,
        commissionPaid: b.affiliateCommission?.status === AffiliateCommissionStatus.PAID,
      })),
    };
  }

  /** Herkese acik "Araci ol" basvurusu: PENDING kayit + admin bildirimi. */
  async submitApplication(
    input: unknown,
    ctx: { userId?: string | null } = {},
  ): Promise<{ ok: true; id: string } | { ok: false; reason: "invalid_data" | "already_applied" }> {
    const parsed = applicationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "invalid_data" };
    const d = parsed.data;
    if (ctx.userId) {
      const existing = await prisma.affiliate.findUnique({ where: { userId: ctx.userId }, select: { id: true } });
      if (existing) return { ok: false, reason: "already_applied" };
    }
    // Basvuru kodu RASTGELE: okunur kod (`AHMET-EV`) onayda verilir, bekleyen basvuru kimsenin adini kapmaz.
    const created = await createWithUniqueCode(applicationCode(), (code) => ({
      code,
      displayName: d.displayName,
      type: TYPE_TO_DB[d.type],
      contactEmail: d.contactEmail?.toLowerCase() ?? null,
      contactPhone: d.contactPhone ?? null,
      applicationNote: d.applicationNote ?? null,
      userId: ctx.userId ?? null,
      status: AffiliateStatus.PENDING,
    }));
    void notificationService
      .notifyAdminsForAffiliateApplication({
        displayName: d.displayName,
        type: d.type,
        contactEmail: d.contactEmail ?? null,
        contactPhone: d.contactPhone ?? null,
        applicationNote: d.applicationNote ?? null,
      })
      .catch((err) => logger.error({ err, affiliateId: created.id }, "affiliate_application_notify_failed"));
    return { ok: true, id: created.id };
  }
}

export type AffiliateStats = {
  clicks: number;
  bookings: number;
  completedBookings: number;
  earned: number;
  unpaid: number;
  paid: number;
};

function emptyStats(): AffiliateStats {
  return { clicks: 0, bookings: 0, completedBookings: 0, earned: 0, unpaid: 0, paid: 0 };
}

/** Turkiye takvim gunu (YYYY-MM-DD). Turkiye 2016'dan beri sabit UTC+3. */
function istanbulDay(d: Date): string {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** `2026-11` -> Turkiye saatiyle o ayin [baslangic, bitis). */
export function monthRange(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${pad(mon + 1)}`;
  return { from: new Date(`${year}-${pad(mon)}-01T00:00:00+03:00`), to: new Date(`${next}-01T00:00:00+03:00`) };
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const APPLICATION_PREFIX = "BASVURU-";
function applicationCode(): string {
  return `${APPLICATION_PREFIX}${generateCode(8)}`;
}
export function isApplicationCode(code: string): boolean {
  return code.startsWith(APPLICATION_PREFIX);
}

/** Onayda verilecek okunur kod: alinmissa (araci ya da davet kodu) `-XXXX` eki. */
async function freeReadableCode(base: string, selfId: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = attempt === 0 ? base : `${base.slice(0, 27)}-${generateCode(4)}`;
    const taken = await prisma.affiliate.findUnique({ where: { code }, select: { id: true } });
    if ((!taken || taken.id === selfId) && !(await codeReservedByReferral(code))) return code;
  }
  return `${base.slice(0, 20)}-${generateCode(8)}`;
}

/** Kod cakisirsa `KOD-XXXX` ile yeniden dener (rastgele ek davet kodu uretecinden). */
async function createWithUniqueCode(
  base: string,
  build: (code: string) => Prisma.AffiliateUncheckedCreateInput,
): Promise<{ id: string; code: string }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = attempt === 0 ? base : `${base.slice(0, 27)}-${generateCode(4)}`;
    try {
      return await prisma.affiliate.create({ data: build(code), select: { id: true, code: true } });
    } catch (e) {
      if (!isUniqueViolation(e) || !JSON.stringify((e as Prisma.PrismaClientKnownRequestError).meta ?? "").includes("code")) throw e;
    }
  }
  throw new Error("affiliate_code_exhausted");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const applicationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    type: z.enum(AFFILIATE_TYPES),
    contactEmail: optionalText(320).pipe(z.string().email().optional()),
    contactPhone: optionalText(20).pipe(z.string().min(7).optional()),
    applicationNote: optionalText(1000),
  })
  .refine((d) => d.contactEmail || d.contactPhone, { message: "contact_required" });

const rate = z.coerce.number().finite().min(0).max(50);

const adminInputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  type: z.enum(AFFILIATE_TYPES),
  code: optionalText(40),
  contactEmail: optionalText(320).pipe(z.string().email().optional()),
  contactPhone: optionalText(20).pipe(z.string().min(7).optional()),
  commissionRate: rate.default(10),
  guestDiscountRate: rate.default(0),
  status: z.enum(AFFILIATE_STATUSES).default("pending"),
  notes: optionalText(1000),
  /** Bagli hesap: e-posta ile bulunur. Bos = bag yok. */
  linkedUserEmail: optionalText(320),
});

export type AffiliateAdminActor = { id: string; role: Role };
export type AffiliateAdminError =
  | "invalid_data"
  | "invalid_code"
  | "duplicate_code"
  | "code_reserved"
  | "not_found"
  | "user_not_found"
  | "user_already_linked";

/**
 * Araci kodu bir kullanici davet koduyla ayni olamaz: misafir ikisini ayni
 * "kod" alanina yazabilir ve hangisinin uygulanacagi belirsizlesir.
 */
async function codeReservedByReferral(code: string): Promise<boolean> {
  return (await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } })) !== null;
}

async function resolveLinkedUser(email: string | undefined, selfId?: string): Promise<{ userId: string | null } | { error: AffiliateAdminError }> {
  if (!email) return { userId: null };
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, affiliate: { select: { id: true } } },
  });
  if (!user) return { error: "user_not_found" };
  if (user.affiliate && user.affiliate.id !== selfId) return { error: "user_already_linked" };
  return { userId: user.id };
}

export async function adminCreateAffiliate(
  actor: AffiliateAdminActor,
  data: unknown,
  ctx: { ip?: string | null } = {},
): Promise<{ ok: true; id: string; code: string } | { ok: false; reason: AffiliateAdminError }> {
  const parsed = adminInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "invalid_data" };
  const d = parsed.data;
  let code: string | null = null;
  if (d.code) {
    code = normalizeAffiliateCode(d.code);
    if (!code) return { ok: false, reason: "invalid_code" };
    if (await codeReservedByReferral(code)) return { ok: false, reason: "code_reserved" };
  }
  const linked = await resolveLinkedUser(d.linkedUserEmail);
  if ("error" in linked) return { ok: false, reason: linked.error };
  const build = (c: string): Prisma.AffiliateUncheckedCreateInput => ({
    code: c,
    displayName: d.displayName,
    type: TYPE_TO_DB[d.type],
    contactEmail: d.contactEmail?.toLowerCase() ?? null,
    contactPhone: d.contactPhone ?? null,
    commissionRate: new Decimal(d.commissionRate),
    guestDiscountRate: new Decimal(d.guestDiscountRate),
    status: d.status.toUpperCase() as AffiliateStatus,
    notes: d.notes ?? null,
    userId: linked.userId,
  });
  let created: { id: string; code: string };
  try {
    // Admin kodu verdiyse AYNEN o: cakisma sessizce baska koda donmemeli.
    created = code
      ? await prisma.affiliate.create({ data: build(code), select: { id: true, code: true } })
      : await createWithUniqueCode(suggestAffiliateCode(d.displayName), build);
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "duplicate_code" };
    throw e;
  }
  writeAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "affiliate.create",
    entityType: "Affiliate",
    entityId: created.id,
    metadata: {
      code: created.code,
      commissionRate: d.commissionRate,
      guestDiscountRate: d.guestDiscountRate,
      status: d.status,
    },
    ip: ctx.ip ?? null,
  });
  return { ok: true, ...created };
}

/**
 * Duzenleme ve onay (PENDING -> ACTIVE). Oran ve durum degisiklikleri ayri
 * denetim kaydi birakir: "bu aracinin orani ne zaman, kim tarafindan
 * degisti" sorusu odemede sorulur. Gecmis rezervasyonlarin oran kopyasi
 * DEGISMEZ.
 */
export async function adminUpdateAffiliate(
  actor: AffiliateAdminActor,
  id: string,
  data: unknown,
  ctx: { ip?: string | null } = {},
): Promise<{ ok: true } | { ok: false; reason: AffiliateAdminError }> {
  const parsed = adminInputSchema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "invalid_data" };
  const d = parsed.data;
  const existing = await prisma.affiliate.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: "not_found" };
  let code = d.code ? normalizeAffiliateCode(d.code) : existing.code;
  if (!code) return { ok: false, reason: "invalid_code" };
  const status = d.status.toUpperCase() as AffiliateStatus;
  // Basvuru rastgele kodla gelir; onayda okunur kod (addan) verilir, admin baska yazmadiysa.
  if (status === AffiliateStatus.ACTIVE && isApplicationCode(code)) {
    code = await freeReadableCode(suggestAffiliateCode(d.displayName), id);
  }
  if (code !== existing.code && (await codeReservedByReferral(code))) return { ok: false, reason: "code_reserved" };
  const linked = await resolveLinkedUser(d.linkedUserEmail, id);
  if ("error" in linked) return { ok: false, reason: linked.error };
  try {
    await prisma.affiliate.update({
      where: { id },
      data: {
        code,
        displayName: d.displayName,
        type: TYPE_TO_DB[d.type],
        contactEmail: d.contactEmail?.toLowerCase() ?? null,
        contactPhone: d.contactPhone ?? null,
        commissionRate: new Decimal(d.commissionRate),
        guestDiscountRate: new Decimal(d.guestDiscountRate),
        status,
        notes: d.notes ?? null,
        userId: linked.userId,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, reason: "duplicate_code" };
    throw e;
  }
  const audit = (action: string, metadata: Prisma.InputJsonValue) =>
    writeAuditLog({ actorUserId: actor.id, actorRole: actor.role, action, entityType: "Affiliate", entityId: id, metadata, ip: ctx.ip ?? null });
  const oldCommission = new Decimal(existing.commissionRate);
  const oldDiscount = new Decimal(existing.guestDiscountRate);
  if (!oldCommission.eq(d.commissionRate) || !oldDiscount.eq(d.guestDiscountRate)) {
    audit("affiliate.rate_change", {
      code,
      commissionRate: { from: oldCommission.toNumber(), to: d.commissionRate },
      guestDiscountRate: { from: oldDiscount.toNumber(), to: d.guestDiscountRate },
    });
  }
  if (existing.status !== status) {
    audit("affiliate.status_change", { code, from: affiliateStatusKey(existing.status), to: d.status });
  }
  if (existing.code !== code || existing.userId !== linked.userId) {
    audit("affiliate.update", {
      ...(existing.code !== code ? { code: { from: existing.code, to: code } } : {}),
      ...(existing.userId !== linked.userId ? { linkedUserChanged: true } : {}),
    });
  }
  return { ok: true };
}

/** Yonetici listesi: bekleyenler once, sonra en yeni; sayaclarla birlikte. */
export async function listAffiliatesForAdmin() {
  const rows = await prisma.affiliate.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { email: true } } },
  });
  const stats = await affiliateService.statsFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, stats: stats.get(r.id)! }));
}

export type AdminAffiliateRow = Awaited<ReturnType<typeof listAffiliatesForAdmin>>[number];

const payoutSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  reference: z.string().trim().min(2).max(120),
  affiliateId: z.string().min(1).max(64).optional(),
});

/**
 * Bir ayin (Turkiye saatiyle, `earnedAt`e gore) ODENMEMIS komisyonlarini
 * odendi isaretler. Odeme sistem disinda (havale) yapilir; burasi defteri
 * kapatir ve referansi yazar. Yalnizca UNPAID satirlara dokunur: tekrar
 * cagri ikinci kez isaretlemez.
 */
export async function adminMarkCommissionsPaid(
  actor: AffiliateAdminActor,
  input: unknown,
  ctx: { ip?: string | null; now?: Date } = {},
): Promise<{ ok: true; count: number; total: number } | { ok: false; reason: "invalid_data" }> {
  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid_data" };
  const range = monthRange(parsed.data.month);
  if (!range) return { ok: false, reason: "invalid_data" };
  const where: Prisma.AffiliateCommissionWhereInput = {
    status: AffiliateCommissionStatus.UNPAID,
    earnedAt: { gte: range.from, lt: range.to },
    ...(parsed.data.affiliateId ? { affiliateId: parsed.data.affiliateId } : {}),
  };
  const paidAt = ctx.now ?? new Date();
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.affiliateCommission.findMany({ where, select: { id: true, amount: true } });
    if (rows.length === 0) return { count: 0, total: new Decimal(0) };
    const updated = await tx.affiliateCommission.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, status: AffiliateCommissionStatus.UNPAID },
      data: {
        status: AffiliateCommissionStatus.PAID,
        paidAt,
        paidById: actor.id,
        payoutReference: parsed.data.reference,
      },
    });
    const total = rows.reduce((acc, r) => acc.plus(new Decimal(r.amount)), new Decimal(0));
    return { count: updated.count, total };
  });
  writeAuditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "affiliate.payout",
    entityType: "Affiliate",
    entityId: parsed.data.affiliateId ?? null,
    metadata: {
      month: parsed.data.month,
      reference: parsed.data.reference,
      count: result.count,
      total: result.total.toNumber(),
    },
    ip: ctx.ip ?? null,
  });
  return { ok: true, count: result.count, total: result.total.toNumber() };
}

/** Odenmemis komisyonlar CSV'si (yonetici). Misafir bilgisi icermez. */
export async function unpaidCommissionsCsv(opts: { month?: string } = {}): Promise<string> {
  const range = opts.month ? monthRange(opts.month) : null;
  const rows = await prisma.affiliateCommission.findMany({
    where: {
      status: AffiliateCommissionStatus.UNPAID,
      ...(range ? { earnedAt: { gte: range.from, lt: range.to } } : {}),
    },
    orderBy: [{ affiliateId: "asc" }, { earnedAt: "asc" }],
    select: {
      baseAmount: true,
      rate: true,
      amount: true,
      earnedAt: true,
      affiliate: { select: { code: true, displayName: true, contactEmail: true, contactPhone: true } },
      booking: { select: { checkInTime: true, shop: { select: { name: true } } } },
    },
  });
  const lines = [
    "affiliateCode,affiliateName,contactEmail,contactPhone,earnedAt,bookingDate,shopName,baseAmount,ratePct,commission",
    ...rows.map((r) =>
      [
        csvCell(r.affiliate.code),
        csvCell(r.affiliate.displayName),
        csvCell(r.affiliate.contactEmail),
        csvCell(r.affiliate.contactPhone),
        csvCell(r.earnedAt.toISOString()),
        csvCell(r.booking.checkInTime.toISOString()),
        csvCell(r.booking.shop.name),
        csvCell(new Decimal(r.baseAmount).toFixed(2)),
        csvCell(new Decimal(r.rate).toFixed(2)),
        csvCell(new Decimal(r.amount).toFixed(2)),
      ].join(","),
    ),
  ];
  return "﻿" + lines.join("\n");
}

export const affiliateService = new AffiliateService();
