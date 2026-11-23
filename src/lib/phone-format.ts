import { normalizeTrGsm10 } from "@/lib/netgsm";

/*
  Numaralar 10 hane saklanir (5XXXXXXXXX). Oldugu gibi yazilinca "553 555..." gorunuyor
  ve `tel:` baglantisi 0'siz aradigi icin Turkiye'de baglanmiyordu (2026-11-23).
*/

/** Gosterim: TR cep numarasi "0553 555 12 34"; tanimadigimiz bicim oldugu gibi kalir. */
export function formatPhoneForDisplay(raw: string | null | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const d = normalizeTrGsm10(v);
  return d ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : v;
}

/** Arama baglantisi: TR cep numarasi ulke koduyla, digeri yalnizca rakam ve "+". */
export function phoneDialHref(raw: string | null | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  const d = normalizeTrGsm10(v);
  if (d) return `tel:+90${d}`;
  const digits = v.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : undefined;
}
