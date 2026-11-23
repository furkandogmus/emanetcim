import { moneyToNumber } from "@/lib/money";
import { stripHtmlToText } from "@/lib/rich-text";
import { toWhatsAppNumber } from "@/lib/whatsapp";

type AdminApplicationSource = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  pricePerDay: unknown;
  capacity: number;
  createdAt: Date;
  owner: { name: string | null; phone: string | null; email: string | null };
};

/**
 * Admin basvuru listesi. Uc ham Prisma `Shop` donuyordu: butun kolonlar ve
 * `Decimal` fiyat string olarak. Alan adlari Flutter'in okuduklariyla ayni
 * (`id`, `name`, `address`, `owner.name/phone`) -- eski surum de calismali.
 * Koordinat onay icin gerekli: konumsuz basvuru `missing_coordinates` alir.
 */
export function toMobileAdminApplication(s: AdminApplicationSource) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    district: s.district,
    hasCoordinates: s.latitude != null && s.longitude != null,
    pricePerDay: moneyToNumber(s.pricePerDay),
    capacity: s.capacity,
    createdAt: s.createdAt.toISOString(),
    owner: {
      name: s.owner.name,
      phone: s.owner.phone,
      email: s.owner.email,
      whatsapp: toWhatsAppNumber(s.owner.phone),
    },
  };
}

type AdminMessageSource = {
  id: string;
  from: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  isRead: boolean;
  category: string;
  createdAt: Date;
  replies: { createdAt: Date }[];
};

/** Mobil gelen kutusunda bir mesajin govdesi bu kadar karakterle sinirli. */
const ADMIN_MESSAGE_BODY_MAX = 4000;

/**
 * `admin/messages` satiri. Ham Prisma satiri (200 mesajin tam HTML'i) yerine: govde yalnizca
 * duz metin (yalniz-HTML posta icin etiketlerden arindirilmis), `repliedAt` en son cevap.
 */
export function toMobileAdminMessage(m: AdminMessageSource) {
  const body = (m.text?.trim() || stripHtmlToText(m.html).trim()).slice(0, ADMIN_MESSAGE_BODY_MAX);
  return {
    id: m.id,
    from: m.from,
    subject: m.subject,
    text: body || null,
    isRead: m.isRead,
    category: m.category,
    createdAt: m.createdAt.toISOString(),
    repliedAt: m.replies[0]?.createdAt.toISOString() ?? null,
  };
}

type AdminPartnerLeadSource = {
  id: string;
  fullName: string;
  phone: string;
  shopName: string | null;
  address: string;
  status: string;
  createdAt: Date;
  convertedAt: Date | null;
  convertedShopId: string | null;
};

/**
 * Mobil admin esnaf on kaydi. `draft` cevirme panelinin on dolgusu
 * (`leadConversionDraft`); istemci kendi eslemesini yazmaz.
 */
export function toMobileAdminPartnerLead(
  l: AdminPartnerLeadSource,
  draft: {
    ownerName: string;
    phone: string;
    email: string;
    shopName: string;
    shopAddress: string;
    city: string;
    district: string;
    location: string;
  },
) {
  return {
    id: l.id,
    fullName: l.fullName,
    phone: l.phone,
    whatsapp: toWhatsAppNumber(l.phone),
    shopName: l.shopName,
    address: l.address,
    contacted: l.status === "CONTACTED",
    converted: l.convertedAt != null,
    convertedShopId: l.convertedShopId,
    createdAt: l.createdAt.toISOString(),
    draft,
  };
}

/** `POST /admin/partner-leads/:id/convert` yaniti (`PartnerLeadService.convertToPartner`). */
export function toMobileLeadConversion(r: {
  alreadyConverted: boolean;
  shopId: string | null;
  userId: string | null;
  resetUrl: string | null;
  activated: boolean;
  activationError?: string;
}) {
  return {
    ok: true as const,
    alreadyConverted: r.alreadyConverted,
    shopId: r.shopId,
    userId: r.userId,
    resetUrl: r.resetUrl,
    activated: r.activated,
    activationFailed: Boolean(r.activationError),
  };
}
