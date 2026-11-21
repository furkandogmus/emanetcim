/**
 * Sunucudaki `normalizeTrGsm10` (src/lib/netgsm.ts) ile ayni kural; yalnizca
 * istegi bosuna atmamak ve WhatsApp baglantisini dogru kurmak icin.
 * Son karar sunucunun.
 */
export function normalizeTrGsm10(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d.length === 10 && d.startsWith("5") ? d : null;
}

/**
 * WhatsApp (`wa.me`) ulke kodlu, "+"siz numara ister. Yalnizca ulke kodu BELLI
 * numaralar icin dondurur: Turkiye cep numarasi (yerel ya da 90'li) ya da acik "+" / "00"
 * on ekli numara. Turistin ulusal bicimli numarasi (0170..., 8...) Turk numarasi sayilmaz:
 * "90" eklenirse baska birinin sohbeti acilir. Bilinmiyorsa `null`: yalnizca Ara gosterilir.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.length > 6 ? digits.slice(1) : null;
  if (digits.startsWith("00")) return digits.length > 6 ? digits.slice(2) : null;
  const tr = normalizeTrGsm10(digits);
  return tr ? `90${tr}` : null;
}
