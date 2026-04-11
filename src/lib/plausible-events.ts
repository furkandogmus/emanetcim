import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent-storage-key";

type PlausibleFn = (
  event: string,
  options?: { props?: Record<string, string | number | boolean> },
) => void;

function propsForPlausible(
  props?: Record<string, string | number | boolean>,
): Record<string, string> | undefined {
  if (!props) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = String(v);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === "all";
  } catch {
    return false;
  }
}

/**
 * Plausible özel olayları — yalnızca çerez onayı `all` iken (ConsentAwareAnalytics ile uyumlu).
 */
export function trackPlausibleEvent(
  eventName: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (!hasAnalyticsConsent()) return;
  const plausible = (
    typeof window !== "undefined"
      ? (window as unknown as { plausible?: PlausibleFn }).plausible
      : undefined
  ) as PlausibleFn | undefined;
  if (!plausible) return;
  try {
    const p = propsForPlausible(props);
    if (p) plausible(eventName, { props: p });
    else plausible(eventName);
  } catch {
    /* yoksay */
  }
}

export const PLAUSIBLE_EVENTS = {
  SearchSubmitted: "SearchSubmitted",
  ShopViewed: "ShopViewed",
  CheckoutStarted: "CheckoutStarted",
  BookingCreated: "BookingCreated",
  PaymentSucceeded: "PaymentSucceeded",
} as const;
