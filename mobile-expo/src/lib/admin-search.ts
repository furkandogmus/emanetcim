import { squash } from "./booking-search";
import type { AdminApplication } from "./types";

/** Telefon "0532 111 22 33" de "5321112233" de yazilsa bulunsun: rakamlar ayrica karsilastirilir. */
function digits(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Bekleyen basvurularda arama (web `/admin/applications` ile ayni alanlar: dukkan,
 * adres, il/ilce, sahibin adi, e-postasi, telefonu). Liste zaten tam; sunucuya gitmez.
 */
export function searchApplications(items: AdminApplication[], query: string): AdminApplication[] {
  const q = squash(query.trim());
  if (!q) return items;
  const qDigits = digits(query);
  return items.filter((a) => {
    const text = [a.name, a.address, a.city, a.district, a.owner.name, a.owner.email].filter(Boolean).join(" ");
    if (squash(text).includes(q)) return true;
    return qDigits.length >= 4 && digits(a.owner.phone ?? "").includes(qDigits.replace(/^(90|0)/, ""));
  });
}
