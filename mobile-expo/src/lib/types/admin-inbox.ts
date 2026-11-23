import type { Role } from "./user";

/** `toMobileAdminApplication` (mobile-dto/admin-inbox.ts). */
export type AdminApplication = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  hasCoordinates: boolean;
  pricePerDay: number;
  capacity: number;
  createdAt: string;
  owner: { name: string | null; phone: string | null; email: string | null; whatsapp?: string | null };
};

/** `toMobileAdminRoleChangeRequest` (mobile-dto/admin-inbox.ts) — `GET /admin/role-approvals`. */
export type AdminRoleChangeRequest = {
  id: string;
  previousRole: Role;
  requestedRole: Role;
  createdAt: string;
  target: { id: string; name: string | null; email: string | null; role: Role };
  requestedBy: { id: string; name: string | null; email: string | null };
  /** Istegi bu yonetici acti: onaylayamaz (sunucu kurali `cannot_self_approve`). */
  isOwnRequest: boolean;
};

/** `toMobileAdminPartnerLead` (mobile-dto/admin-inbox.ts) — `GET /admin/partner-leads`. Yeni alanlar istege bagli: eski sunucu. */
export type AdminPartnerLead = {
  id: string;
  fullName: string;
  phone: string;
  whatsapp?: string | null;
  shopName: string | null;
  address: string;
  contacted: boolean;
  converted?: boolean;
  convertedShopId?: string | null;
  createdAt: string;
  draft?: {
    ownerName: string;
    phone: string;
    email: string;
    shopName: string;
    shopAddress: string;
    city: string;
    district: string;
    location: string;
  };
};

/** `toMobileLeadConversion` (mobile-dto/admin-inbox.ts) — `POST /admin/partner-leads/:id/convert`. */
export type LeadConversion = {
  ok: true;
  alreadyConverted: boolean;
  shopId: string | null;
  userId: string | null;
  resetUrl: string | null;
  activated: boolean;
  activationFailed?: boolean;
};

/** `admin/messages` (sunucu `toMobileAdminMessage`). */
export type ContactMessage = {
  id: string;
  from: string;
  subject: string | null;
  text: string | null;
  isRead: boolean;
  category?: string;
  createdAt: string;
  /** Son cevabin zamani; cevaplanmamissa null. Eski sunucuda yok. */
  repliedAt?: string | null;
};
