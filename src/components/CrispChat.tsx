"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent-storage-key";

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

/**
 * Crisp canlı destek widget'ı.
 * - Sadece NEXT_PUBLIC_CRISP_WEBSITE_ID tanımlıysa yüklenir.
 * - Çerez onayı "all" ise yüklenir, geri çekilirse gizler.
 * - Giriş yapmış kullanıcıyı otomatik tanımlar.
 */
export default function CrispChat() {
  const { data: session } = useSession();

  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
    if (!websiteId) return;

    const hasConsent = () => {
      try {
        return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === "all";
      } catch {
        return false;
      }
    };

    const init = () => {
      if (!hasConsent()) return;
      if (document.querySelector("script[data-bagajpark-crisp]")) {
        // Already loaded — just ensure it's visible
        if (window.$crisp) {
          (window.$crisp as unknown[]).push(["do", "chat:show"]);
        }
        return;
      }

      window.$crisp = [];
      window.CRISP_WEBSITE_ID = websiteId;

      const s = document.createElement("script");
      s.src = "https://client.crisp.chat/l.js";
      s.async = true;
      s.setAttribute("data-bagajpark-crisp", "1");
      document.head.appendChild(s);
    };

    const hide = () => {
      if (window.$crisp) {
        (window.$crisp as unknown[]).push(["do", "chat:hide"]);
      }
    };

    init();

    const onConsent = () => {
      const v = (() => {
        try {
          return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        } catch {
          return null;
        }
      })();
      if (v === "all") init();
      else hide();
    };
    window.addEventListener("bagajpark:cookie-consent", onConsent);
    return () => window.removeEventListener("bagajpark:cookie-consent", onConsent);
  }, []);

  // Kullanıcı kimliğini Crisp'e bildir
  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(() => {
      if (!window.$crisp) return;
      clearInterval(interval);
      if (session.user.email) {
        (window.$crisp as unknown[]).push(["set", "user:email", [session.user.email]]);
      }
      if (session.user.name) {
        (window.$crisp as unknown[]).push(["set", "user:nickname", [session.user.name]]);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [session]);

  return null;
}
