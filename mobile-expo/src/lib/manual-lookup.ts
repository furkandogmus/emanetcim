import { partnerSearchTerm, refineServerSearch, searchBookings } from "./booking-search";
import type { PartnerBooking } from "./types";

export type ManualLookupResult = {
  /** Kesin tek eslesme: detay dogrudan acilir. */
  open: PartnerBooking | null;
  /** Esnafin sececegi adaylar (en fazla 5). */
  choices: PartnerBooking[];
};

/**
 * QR yerine yazilan kod / ad / telefon. Once yuklu listede, yoksa sunucuda aranir; arama
 * ucu hata verirse liste tazelenip yerelde aranir. Detay yalnizca satirin kendisi terime
 * uyuyorsa kendiliginden acilir: telefonla gelen (satirda gorunmeyen) ya da suzulmemis
 * eski sunucu sonucu tek satirsa bile yanlis rezervasyon acilmasin, esnaf secsin.
 */
export async function manualLookup(
  text: string,
  cached: PartnerBooking[],
  deps: {
    searchServer: (term: string) => Promise<PartnerBooking[]>;
    refetchList: () => Promise<PartnerBooking[]>;
  },
): Promise<ManualLookupResult> {
  let found = searchBookings(cached, text);
  const term = partnerSearchTerm(text);
  if (found.length === 0 && term) {
    try {
      found = refineServerSearch(await deps.searchServer(term), term);
    } catch {
      found = searchBookings(await deps.refetchList().catch(() => []), text);
    }
  }
  if (found.length === 1 && searchBookings(found, text).length === 1) return { open: found[0], choices: [] };
  return { open: null, choices: found.slice(0, 5) };
}
