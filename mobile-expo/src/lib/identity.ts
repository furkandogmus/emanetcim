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

export type IdentityMode = "email" | "phone";
export type IdentityFields = { mode: IdentityMode; email: string; phone: string };

/**
 * Tek kutuya yazilan metnin hangi moda ait oldugunu belirler.
 *
 * `locked`: kullanici sekmeye kendisi dokundu. O zaman e-posta -> telefon
 * otomatik gecisi KAPALI: "1907x@..." ya da "05321234567@gmail.com" gibi rakamla
 * baslayan e-posta, phone-pad klavyede (harf ve @ yok) yazilamaz; sekme secimi
 * son sozdur. Telefon kutusuna harf/@ gelirse (yapistirma, otomatik doldurma)
 * her durumda e-postaya donulur.
 */
export function applyIdentityInput(state: IdentityFields, value: string, locked: boolean): IdentityFields {
  if (state.mode === "email") {
    if (!locked && looksLikePhone(value)) return { mode: "phone", email: "", phone: value };
    return { ...state, email: value };
  }
  if (/[a-z@]/i.test(value)) return { mode: "email", email: value, phone: "" };
  return { ...state, phone: value };
}

/** Sekme degisiminde yazilan metni yitirme: telefon -> e-posta her zaman, e-posta -> telefon yalniz telefon gibiyse. */
export function switchIdentityMode(state: IdentityFields, next: IdentityMode): IdentityFields {
  if (next === state.mode) return state;
  if (next === "email") return { mode: "email", email: state.email || state.phone, phone: "" };
  return looksLikePhone(state.email)
    ? { mode: "phone", email: "", phone: state.email }
    : { mode: "phone", email: state.email, phone: state.phone };
}
