import type { Role } from "./types/user";

/**
 * Web baglantisinin (`app-link-path.ts`) uygulamadaki hedefi. Yol cevirisi oturumu
 * bilmeden calisir (`+native-intent`); rol ve giris karari `/link` ekraninda burada verilir.
 */
export type DeepLinkKind = "booking" | "partner-booking" | "affiliate" | "register" | "partner-invite";
export type DeepLink = { kind: DeepLinkKind; id?: string };

export type DeepLinkOutcome =
  | { type: "go"; href: string }
  | { type: "login" }
  | { type: "mismatch"; need: "partner" }
  | { type: "web"; path: string };

const KINDS: readonly DeepLinkKind[] = ["booking", "partner-booking", "affiliate", "register", "partner-invite"];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
// Rezervasyon kimligi UUID (e-posta ve push da boyle): `settings`, `modify` gibi rota adlari gecmesin.
export const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseDeepLink(params: { kind?: unknown; id?: unknown }): DeepLink | null {
  const kind = typeof params.kind === "string" ? (params.kind as DeepLinkKind) : null;
  if (!kind || !KINDS.includes(kind)) return null;
  const id = typeof params.id === "string" && params.id ? params.id : undefined;
  if (id !== undefined && !ID.test(id)) return null;
  if ((kind === "booking" || kind === "partner-booking") && !(id && BOOKING_ID.test(id))) return null;
  return { kind, id };
}

/** `role` null: oturum kapali. */
export function resolveDeepLink(link: DeepLink, role: Role | null): DeepLinkOutcome {
  switch (link.kind) {
    case "booking":
      if (!role) return { type: "login" };
      // Esnaf misafirin bilet baglantisini (kamera, paylasim) kendi rezervasyon ekraninda acar;
      // dukkani baskasinin ise ekran sunucudan bulunamadi durumunu gosterir.
      if (role === "PARTNER") return { type: "go", href: `/partner/${link.id}` };
      if (role === "ADMIN") return { type: "go", href: `/admin/booking/${link.id}` };
      return { type: "go", href: `/bookings/${link.id}` };
    case "partner-booking":
      if (!role) return { type: "login" };
      if (role === "PARTNER") return { type: "go", href: `/partner/${link.id}` };
      if (role === "ADMIN") return { type: "go", href: `/admin/booking/${link.id}` };
      return { type: "mismatch", need: "partner" };
    case "affiliate":
      return role ? { type: "go", href: "/affiliate" } : { type: "login" };
    case "register":
      // Kayit = kodla giris (hesap yoksa acilir). Davet kodu zaten saklandi.
      return { type: "go", href: role ? "/" : "/login" };
    case "partner-invite":
      // Esnaf basvurusu uygulamada yok: davet kodu web formuna dolsun.
      return {
        type: "web",
        path: link.id ? `register?role=PARTNER&ref=${encodeURIComponent(link.id)}` : "register?role=PARTNER",
      };
  }
}

/*
  Girissiz acilan baglanti giristen sonra kaldigi yerden devam eder. Yalniz bellekte ve
  kisa omurlu: vazgecip saatler sonra giren kullanici eski bir ekrana firlatilmasin.
*/
const PENDING_TTL_MS = 15 * 60 * 1000;
let pending: { link: DeepLink; savedAt: number } | null = null;

export function savePendingLink(link: DeepLink, now = Date.now()): void {
  pending = { link, savedAt: now };
}

export function clearPendingLink(): void {
  pending = null;
}

export function takePendingLink(now = Date.now()): DeepLink | null {
  const p = pending;
  pending = null;
  if (!p || now - p.savedAt > PENDING_TTL_MS) return null;
  return p.link;
}

export function deepLinkHref(link: DeepLink): string {
  return `/link?kind=${link.kind}${link.id ? `&id=${encodeURIComponent(link.id)}` : ""}`;
}
