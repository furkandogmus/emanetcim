import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

/**
 * Sentry'ye giden olaydan kisisel veri ayiklama: e-posta, telefon, JWT / Bearer, sorgu
 * jetonlari. `sendDefaultPii: false` IP'yi ve cerezi keser ama mesaj, hata metni ve
 * breadcrumb icindeki serbest metni gormez; asil sizinti oradan olur (API hata metni
 * e-postayi geri yansitabiliyor).
 */
const PATTERNS: [RegExp, string][] = [
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/((?:token|code|password|secret|otp|refresh|access_token|key)=)[^&\s#]+/gi, "$1[redacted]"],
  // TR/uluslararasi telefon (0532 123 45 67, +90 532 1234567); ISO tarih ve UUID eslesmez.
  [/(?<![\w:-])(?:\+?\d{1,3}[\s.-]?)?\(?0?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?![\w:-])/g, "[phone]"],
];

export function scrubString(s: string): string {
  return PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), s);
}

const SECRET_KEY = /^(password|pass|token|access_?token|refresh_?token|id_?token|secret|authorization|cookie|email|phone|otp|code|iban)$/i;

export function scrubValue(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return scrubString(v);
  if (depth > 6 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) && typeof x !== "object" ? "[redacted]" : scrubValue(x, depth + 1);
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
  if (out.breadcrumbs) out.breadcrumbs = out.breadcrumbs.map((b) => scrubBreadcrumb(b)).filter((b): b is Breadcrumb => !!b);
  if (out.extra) out.extra = scrubValue(out.extra) as ErrorEvent["extra"];
  if (out.contexts) out.contexts = scrubValue(out.contexts) as ErrorEvent["contexts"];
  return out;
}
