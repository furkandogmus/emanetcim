"use client";

import { useEffect } from "react";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/components/CookieConsent";

/**
 * Yalnızca çerez onayı `all` iken Plausible yükler (NEXT_PUBLIC_PLAUSIBLE_DOMAIN).
 */
export default function ConsentAwareAnalytics() {
  useEffect(() => {
    const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
    if (!domain) return;

    const load = () => {
      try {
        const v = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        if (v !== "all") return;
      } catch {
        return;
      }
      if (document.querySelector("script[data-bagajpark-plausible]")) return;
      const s = document.createElement("script");
      s.defer = true;
      s.src = "https://plausible.io/js/script.js";
      s.setAttribute("data-domain", domain);
      s.setAttribute("data-bagajpark-plausible", "1");
      document.head.appendChild(s);
    };

    load();
    const onConsent = () => load();
    window.addEventListener("bagajpark:cookie-consent", onConsent);
    return () =>
      window.removeEventListener("bagajpark:cookie-consent", onConsent);
  }, []);

  return null;
}
