const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Identity = { email: string } | { phone: string };

/**
 * Giris alani e-posta ya da telefon alir (web'deki esnaf sekmesiyle ayni).
 * `@` varsa e-posta; yoksa yalnizca rakam, bosluk, `+`, `-`, parantez ve 10-12
 * rakam ise telefon. Telefonun bicimi (05xx / 5xx / +90) sunucuda
 * `normalizeTrGsm10` ile cozulur; burada yalnizca rakamlar gonderilir.
 */
export function parseIdentity(raw: string): Identity | null {
  const value = raw.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL_RE.test(email) ? { email } : null;
  }
  if (!/^[\d\s()+-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 12 ? { phone: digits } : null;
}

/** Ekranda gosterilen: e-posta ya da girildigi haliyle telefon. */
export function identityLabel(id: Identity) {
  return "email" in id ? id.email : id.phone;
}
