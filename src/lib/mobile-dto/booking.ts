import { moneyToNumber } from "@/lib/money";
import { isBagRevisableStatus } from "@/lib/bag-revision-status";
import { isBookingExpired, noShowAvailableAt } from "@/lib/booking-closure";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { lateCloseAt } from "@/lib/late-dropoff";
import { DISPUTE_STATUSES, type DisputeStatus } from "@/lib/dispute-status";
import { fullAddress } from "./address";

/**
 * Mobil istemciye giden GÖVDE biçimleri — tek yer.
 *
 * NEDEN VAR (2026-08-25'te ölçüldü): aynı alan-alan eşleme iki uçta ayrı ayrı
 * yazılmıştı (`bookings/me` ↔ `bookings/[id]`, `shops/nearby` ↔ `shops/[id]`).
 * Henüz ayrışmamışlardı ama **ayrışma zaten başlamıştı**: `isVerified` yalnızca
 * `shops/nearby` yanıtında vardı, detay yanıtında yoktu — yani mobil uygulama
 * liste ekranında "doğrulanmış esnaf" rozetini çizebiliyor, detay ekranında
 * çizemiyordu. Aynı dükkan, iki ekranda iki farklı gerçek.
 *
 * Alan EKLEMEK artık tek dosyayı değiştirmek demek; bir ucun geride kalması için
 * bir yüzey kalmıyor.
 *
 * ÖZET / DETAY ayrımı bilinçli: liste yanıtı küçük kalmalı (sayfa başına 50
 * kayıt), detay yanıtı QR, mühür ve konum taşır. Detay, özetin ÜST KÜMESİDİR —
 * yani listede görünen bir alan detayda da vardır, tersi değil.
 */

/** Prisma `Decimal` alanları istemciye sayı olarak çıkar (proje kuralı). */
type BookingSummarySource = {
  id: string;
  shopId: string;
  shop: { name: string };
  checkInTime: Date;
  checkOutTime: Date;
  bagCountS: number;
  bagCountM: number;
  bagCountXl: number;
  totalPrice: unknown;
  status: string;
  /** `withCancelReasons` ile eklenir; eklenmemisse `null` cikar. */
  cancelReason?: string | null;
};

// Kural `@/lib/booking-closure`ta: web misafir sayfasi da ayni cevabi okur.
export { isBookingExpired };

export function toMobileBookingSummary(b: BookingSummarySource) {
  return {
    id: b.id,
    shopId: b.shopId,
    shopName: b.shop.name,
    checkInTime: b.checkInTime,
    checkOutTime: b.checkOutTime,
    bagCountS: b.bagCountS,
    bagCountM: b.bagCountM,
    bagCountXl: b.bagCountXl,
    totalPrice: moneyToNumber(b.totalPrice),
    status: b.status,
    // Eski uygulama bilinmeyen alani yok sayar; yeni istemci QR/iptal/degistir'i buna gore gizler.
    expired: isBookingExpired(b),
    cancelReason: b.status === "CANCELLED" ? (b.cancelReason ?? null) : null,
  };
}

type BookingDetailSource = BookingSummarySource & {
  qrCodeToken: string | null;
  guest: { name: string | null; phone?: string | null } | null;
  guestPhone?: string | null;
  guestName?: string | null;
  shop: {
    name: string;
    /* Sema `Float?`: koordinatsiz dukkan (henuz haritaya islenmemis) mumkun. */
    latitude: number | null;
    longitude: number | null;
    address?: string | null;
    district?: string | null;
    city?: string | null;
    owner: { phone: string | null };
  };
  seals: Array<{ sealNumber: number; bagIndex: number; bagSize: string }>;
  review?: { id: string } | null;
  dispute?: { id: string; status?: string | null } | null;
  pendingBagRevision?: unknown;
  /* Eski cagiranlar (testler) bu alanlari vermeyebilir: `null` sayilir. */
  checkedInAt?: Date | null;
  lateHoldUntil?: Date | null;
};

/**
 * Misafirin gordugu bildirim durumu. Sema `String`: listede olmayan bir deger
 * "OPEN" sayilir (web misafir sayfasindaki `disputeStatusView` ile ayni kural).
 */
function toMobileDisputeStatus(dispute: { status?: string | null } | null | undefined): DisputeStatus | null {
  if (!dispute) return null;
  const s = dispute.status ?? "OPEN";
  return (DISPUTE_STATUSES as readonly string[]).includes(s) ? (s as DisputeStatus) : "OPEN";
}

/**
 * Esnafin onerdigi, misafir onayi bekleyen valiz duzeltmesi. Kayit JSON
 * (`persistPendingRevision`); bozuk ya da eksikse `null` -- istemci karti hic cizmez.
 */
function toMobilePendingBagRevision(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : null);
  const s = n("bagCountS"), m = n("bagCountM"), xl = n("bagCountXl");
  const extra = n("extraAmount"), next = n("newTotal");
  if (s == null || m == null || xl == null || extra == null || next == null) return null;
  return { bagCountS: s, bagCountM: m, bagCountXl: xl, extraAmount: extra, newTotal: next };
}

export function toMobileBookingDetail(
  b: BookingDetailSource,
  /** `hideShopContact`: dukkan personeli sahibin kisisel numarasini almaz (web ile ayni). */
  opts: { operator?: boolean; hideShopContact?: boolean } = {},
) {
  /*
    Misafirin telefonu YALNIZCA islemi yapan esnaf/yonetici icin ve YALNIZCA
    aktif rezervasyonda (gelmeyen/gec kalan misafiri aramak icin). Kural burada,
    DTO'da: rota ayri bir kopya tutarsa ayrisir. Bitmis kayitta bos doner.
  */
  const active = !["CHECKED_OUT", "CANCELLED"].includes(b.status);
  const guestPhone = opts.operator && active ? (b.guest?.phone ?? b.guestPhone ?? "") : "";
  return {
    ...toMobileBookingSummary(b),
    qrCodeToken: b.qrCodeToken,
    // Kapidan gelen misafirin hesabi yok; adi tezgahta girildi.
    guestName: b.guest?.name ?? b.guestName ?? "",
    latitude: b.shop.latitude,
    longitude: b.shop.longitude,
    shopPhone: opts.hideShopContact ? "" : (b.shop.owner.phone ?? ""),
    // Web `BookingDetailActions` ile ayni cevrim; cevrilemeyen numarada WhatsApp dugmesi cizilmez.
    shopWhatsapp: opts.hideShopContact ? null : toWhatsAppNumber(b.shop.owner.phone),
    // Turist taksiciye gosterebilsin; koordinatsiz dukkanda yol tarifi de buradan.
    shopAddress: fullAddress(b.shop.address, b.shop.district, b.shop.city),
    seals: b.seals.map((s) => ({
      sealNumber: s.sealNumber,
      bagIndex: s.bagIndex,
      bagSize: s.bagSize,
    })),
    // Istemci "degerlendir" / "sorun bildir" dugmesini buna gore gizler; once
    // yalnizca sunucunun 409'uyla ogreniyordu.
    hasReview: !!b.review,
    hasDispute: !!b.dispute,
    // Kart "inceliyoruz"da takili kalmasin: sonuclanan bildirim kendi metnini gosterir (bulgu 52).
    disputeStatus: toMobileDisputeStatus(b.dispute),
    /*
      Yalnizca duzeltilebilir durumda: iptal edilmis/teslim edilmis rezervasyonda
      kalmis bir oneri misafire onaylayamayacagi bir kart cizdiriyordu (bulgu 57).
    */
    pendingBagRevision: isBagRevisableStatus(b.status)
      ? toMobilePendingBagRevision(b.pendingBagRevision)
      : null,
    guestPhone,
    // Yalniz islemi yapan taraf icin: "Misafir gelmedi" dugmesinin acildigi an.
    noShowAvailableAt: opts.operator ? (noShowAvailableAt(b)?.toISOString() ?? null) : null,
    // Gec birakma: otomatik kapanis ani ve varsa esnafin bekletmesi. Eski uygulama yok sayar.
    lateCloseAt:
      lateCloseAt({ ...b, checkedInAt: b.checkedInAt ?? null, lateHoldUntil: b.lateHoldUntil ?? null })?.toISOString() ??
      null,
    lateHoldUntil: b.lateHoldUntil?.toISOString() ?? null,
  };
}

/** Esnaf rezervasyon listesi satiri: ozet + misafir adi. */
export function toMobilePartnerBookingRow(
  b: Omit<BookingSummarySource, "shop"> & { guest: { name: string | null } | null; guestName?: string | null },
  shopName: string,
) {
  return {
    ...toMobileBookingSummary({ ...b, shop: { name: shopName } }),
    guestName: b.guest?.name ?? b.guestName ?? "",
  };
}
