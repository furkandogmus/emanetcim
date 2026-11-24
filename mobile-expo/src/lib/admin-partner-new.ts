/**
 * Yoneticinin sifirdan esnaf acma / misafiri cevirme formu. Kurallarin asli sunucuda
 * (`../src/services/AdminPartnerCreateService.ts`); burada yalniz gonder dugmesini acan
 * kaba sinirlar var (koordinati sunucu cozer: Google Maps linki ya da `enlem, boylam`).
 */
export type PartnerNewForm = {
  ownerName: string;
  phone: string;
  email: string;
  shopName: string;
  shopAddress: string;
  city: string;
  district: string;
  location: string;
};

export const EMPTY_PARTNER_FORM: PartnerNewForm = {
  ownerName: "",
  phone: "",
  email: "",
  shopName: "",
  shopAddress: "",
  city: "",
  district: "",
  location: "",
};

export type GuestSource = { id: string; name: string | null; email: string | null; phone: string | null };

export function formFromGuest(g: GuestSource): PartnerNewForm {
  return { ...EMPTY_PARTNER_FORM, ownerName: g.name ?? "", email: g.email ?? "", phone: g.phone ?? "" };
}

export function partnerFormIssues(f: PartnerNewForm, converting: boolean): (keyof PartnerNewForm)[] {
  const out: (keyof PartnerNewForm)[] = [];
  if (!converting && f.ownerName.trim().length < 2) out.push("ownerName");
  if (f.phone.replace(/\D/g, "").length < 10) out.push("phone");
  if (!converting && f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) out.push("email");
  if (f.shopName.trim().length < 2) out.push("shopName");
  if (f.shopAddress.trim().length < 5) out.push("shopAddress");
  if (f.location.trim().length < 3) out.push("location");
  return out;
}

/** Cevirmede ad ve e-posta hesaptan gelir; govdeye girmez (sunucu `strict`). */
export function partnerBody(f: PartnerNewForm, fromUserId: string | null) {
  const shop = {
    phone: f.phone.trim(),
    shopName: f.shopName.trim(),
    shopAddress: f.shopAddress.trim(),
    ...(f.city.trim() ? { city: f.city.trim() } : {}),
    ...(f.district.trim() ? { district: f.district.trim() } : {}),
    location: f.location.trim(),
  };
  return fromUserId
    ? { fromUserId, ...shop }
    : { ownerName: f.ownerName.trim(), ...(f.email.trim() ? { email: f.email.trim() } : {}), ...shop };
}
