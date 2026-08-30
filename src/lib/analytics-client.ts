import { hasAnalyticsConsent } from "@/lib/plausible-events";
import type { ClientAnalyticsEventName } from "@/lib/analytics-events";

const SESSION_STORAGE_KEY = "bp_analytics_sid";
/** `src/lib/analytics-server.ts` bu ADI aynen okuyor — ikisi birlikte değişmeli. */
const SESSION_COOKIE_NAME = "bp_analytics_sid";
const SESSION_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

/**
 * İstemcide üretilip localStorage'da saklanan anonim oturum kimliği. Kişisel
 * veri değil — kullanıcıya, e-postaya, IP'ye bağlanmıyor; yalnızca aynı
 * tarayıcının farklı sayfa görüntülemelerini birbirine bağlamaya yarıyor.
 *
 * Aynı kimlik bir çereze de yazılıyor ki sunucu tarafında izlenen olaylar
 * (arama, dükkan görüntüleme — bkz. `analytics-server.ts`) aynı oturuma
 * bağlanabilsin.
 */
function getOrCreateSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const id = existing ?? crypto.randomUUID();
    if (!existing) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    document.cookie = `${SESSION_COOKIE_NAME}=${id}; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
    return id;
  } catch {
    // localStorage kapalıysa (gizli sekme vb.) oturum boyunca sabit bir tekil
    // olmayan kimlik kullanılır — olay yine sayılır, oturumlar arası ayrım kaybolur.
    return "no-storage";
  }
}

/**
 * Sayfa görüntüleme olayını `/api/analytics/event`'e gönderir. Yalnızca
 * çerez onayı `all` iken (bkz. `hasAnalyticsConsent`) — onaysız hiçbir istek
 * atılmaz.
 */
export function trackEvent(
  name: ClientAnalyticsEventName,
  metadata?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  send(
    JSON.stringify({
      name,
      sessionId: getOrCreateSessionId(),
      path: window.location.pathname,
      locale: document.documentElement.lang || undefined,
      metadata,
    }),
  );
}

export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  send(
    JSON.stringify({
      name: "page_view",
      sessionId: getOrCreateSessionId(),
      path,
      referrer: document.referrer || undefined,
      locale: document.documentElement.lang || undefined,
    }),
  );
}

/**
 * Gövdeyi `/api/analytics/event`'e yollar. `sendBeacon` varsa onu kullanır —
 * sayfa kapanırken bile teslim edilir; yoksa `keepalive` fetch'e düşer.
 *
 * TEK YERDE: `trackPageView` ve `trackEvent` aynı gönderim yolunu paylaşır.
 * Kopyalansaydı biri `sendBeacon` düzeltmesini alır, diğeri geride kalırdı.
 */
function send(payload: string): void {
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/analytics/event",
        new Blob([payload], { type: "text/plain" }),
      );
      return;
    }
  } catch {
    // sendBeacon bazı tarayıcı/uzantı kombinasyonlarında atabilir — fetch'e düş.
  }

  void fetch("/api/analytics/event", {
    method: "POST",
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
