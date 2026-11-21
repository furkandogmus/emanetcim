const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Identity = { email: string } | { phone: string };

/**
 * Sunucudaki `normalizeTrGsm10` (src/lib/netgsm.ts) ile ayni kural: 05xx / 5xx /
 * +90 5xx -> 5xxxxxxxxx. Turkiye cep numarasi degilse null. Istemci de ayni
 * kurala bakar: 10-12 haneli ama TR cep olmayan numara sunucuda `invalid_format`
 * ile donuyor ve genel hata mesajina dusuyordu.
 */
export function normalizeTrGsm10(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d.length === 10 && d.startsWith("5") ? d : null;
}

/**
 * E-posta alanina yazilan metin telefon gibi mi? `@` yok, yalnizca rakam /
 * bosluk / `+` / `-` / parantez ve en az 3 rakam. Esik, "34ahmet@..." gibi
 * rakamla baslayan e-postalarin ilk tusta telefon moduna dusmesini onler;
 * yine de dusen biri "E-posta" sekmesiyle geri doner.
 */
export function looksLikePhone(raw: string): boolean {
  const value = raw.trim();
  if (value.includes("@") || !/^[+\d][\d\s()+-]*$/.test(value)) return false;
  return value.replace(/\D/g, "").length >= 3;
}

/** Yalnizca telefon: TR cep numarasi ya da null. */
export function parsePhone(raw: string): { phone: string } | null {
  const phone = normalizeTrGsm10(raw);
  return phone ? { phone } : null;
}

/**
 * Giris alani e-posta ya da telefon alir. `@` varsa e-posta; yoksa Turkiye cep
 * numarasi (`normalizeTrGsm10`), sunucunun gordugu bicimle.
 */
export function parseIdentity(raw: string): Identity | null {
  const value = raw.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL_RE.test(email) ? { email } : null;
  }
  return parsePhone(value);
}

/** Ekranda gosterilen: e-posta ya da telefon. */
export function identityLabel(id: Identity) {
  return "email" in id ? id.email : id.phone;
}
