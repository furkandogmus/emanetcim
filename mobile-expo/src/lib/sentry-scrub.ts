import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

/**
 * Sentry'ye giden olaydan kisisel veri ayiklama: e-posta, telefon, JWT / Bearer, sorgu
 * jetonlari. `sendDefaultPii: false` IP'yi ve cerezi keser ama mesaj, hata metni ve
 * breadcrumb icindeki serbest metni gormez; asil sizinti oradan olur (API hata metni
 * e-postayi geri yansitabiliyor).
 */
const PATTERNS: [RegExp, string | ((m: string) => string)][] = [
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/((?:token|code|password|secret|otp|refresh|access_token|key|email|phone)=)[^&\s#]+/gi, "$1[redacted]"],
  // Uluslararasi (+ ile) ya da ayiricili numara, 9-15 rakam. Ayiricisiz rakam dizisi (ms
  // zaman damgasi, sayac) dokunulmaz; ISO tarih 8 rakamla esige takilmaz.
  [/(?<![\w:.\/-])(?:\+\d[\d\s().-]{7,20}\d|\(?\d{2,4}\)?(?:[\s.-]\(?\d{2,4}\)?){2,5})(?![\w:\/-])/g, (m) => {
    const digits = m.replace(/\D/g, "").length;
    return digits >= 9 && digits <= 15 ? "[phone]" : m;
  }],
  // Ayiricisiz TR cep numarasi (05xx / 5xx); 13 haneli ms zaman damgasi 1 ile baslar, eslesmez.
  [/(?<!\d)0?5\d{9}(?!\d)/g, "[phone]"],
];

export function scrubString(s: string): string {
  return PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep as string), s);
}

// Anahtar adinda gecerse deger hic gonderilmez (shopName, guestPhone, refresh_token...).
const SECRET_KEY = /phone|e-?mail|name|address|token|secret|passw|authorization|cookie|iban|otp/i;

export function scrubValue(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return scrubString(v);
  if (depth > 6 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) && (x === null || typeof x !== "object") ? "[redacted]" : scrubValue(x, depth + 1);
  }
  return out;
}

/** Adresin sorgusu atilir: `?code=`, `?email=` gibi alanlar yol disinda tasinir. */
function stripQuery(url: unknown): unknown {
  return typeof url === "string" ? scrubString(url.split("?")[0]) : url;
}

export function scrubBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  const out: Breadcrumb = { ...b };
  if (out.message) out.message = scrubString(out.message);
  if (out.data) {
    const data = { ...out.data };
    // Istek/yanit govdesi hic gitmez; adres sorgusuz.
    delete data.body;
    delete data.request_body;
    delete data.response_body;
    if ("url" in data) data.url = stripQuery(data.url);
    if ("from" in data) data.from = stripQuery(data.from);
    if ("to" in data) data.to = stripQuery(data.to);
    out.data = scrubValue(data) as Breadcrumb["data"];
  }
  return out;
}

export function scrubEvent(e: ErrorEvent): ErrorEvent | null {
  const out: ErrorEvent = { ...e };
  if (out.message) out.message = scrubString(out.message);
  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((x) => ({ ...x, value: x.value ? scrubString(x.value) : x.value })),
    };
  }
  if (out.request) {
    out.request = { ...out.request, url: stripQuery(out.request.url) as string | undefined };
    delete out.request.data;
    delete out.request.cookies;
    delete out.request.headers;
    delete out.request.query_string;
  }
  if (out.user) out.user = out.user.id ? { id: out.user.id } : undefined;
  if (out.logentry) {
    out.logentry = {
      ...out.logentry,
      message: out.logentry.message ? scrubString(out.logentry.message) : out.logentry.message,
      params: out.logentry.params ? (scrubValue(out.logentry.params) as unknown[]) : out.logentry.params,
    };
  }
  if (out.fingerprint) out.fingerprint = out.fingerprint.map((f) => scrubString(f));
  if (out.tags) out.tags = scrubValue(out.tags) as ErrorEvent["tags"];
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map((b) => scrubBreadcrumb(b)).filter((b): b is Breadcrumb => !!b);
  if (out.extra) out.extra = scrubValue(out.extra) as ErrorEvent["extra"];
  if (out.contexts) out.contexts = scrubValue(out.contexts) as ErrorEvent["contexts"];
  return out;
}
