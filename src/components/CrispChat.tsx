"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent-storage-key";

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

const CRISP_SCRIPT_SRC = "https://client.crisp.chat/l.js";
const CONSENT_EVENT = "bagajpark:cookie-consent";

function readConsentAll(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === "all";
  } catch {
    return false;
  }
}

function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Crisp'i bir kez yükler ve sohbeti açar. Tekrar çağrı yalnızca açar. */
export function loadCrispAndOpen(websiteId: string): void {
  if (!document.querySelector("script[data-bagajpark-crisp]")) {
    window.$crisp = window.$crisp ?? [];
    window.CRISP_WEBSITE_ID = websiteId;
    const s = document.createElement("script");
    s.src = CRISP_SCRIPT_SRC;
    s.async = true;
    s.setAttribute("data-bagajpark-crisp", "1");
    document.head.appendChild(s);
  }
  // Kuyruk: betik yüklenince Crisp bu komutları sırayla işler.
  window.$crisp.push(["do", "chat:show"]);
  window.$crisp.push(["do", "chat:open"]);
}

/**
 * Crisp canlı destek: hafif bir "cephe" düğmesi, gerçek widget ilk tıklamada.
 *
 * NEDEN (2026-11-22): `l.js` hydration anında yükleniyordu, yani onay vermiş
 * HER ziyaretçi, sohbeti hiç açmasa da ~200 KB üçüncü taraf JS ve bir
 * WebSocket için ana iş parçacığında bedel ödüyordu (INP/TBT). Artık düğme
 * yerel bir bileşen; betik yalnızca tıklanınca iner ve sohbet açılır.
 *
 * Onay kuralı DEĞİŞMEDİ: düğme de, betik de yalnızca çerez onayı `all` iken;
 * onay geri çekilirse ikisi de gizlenir.
 */
export default function CrispChat() {
  const t = useTranslations("Common");
  const { data: session } = useSession();
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
  // Sunucuda onay bilinmez (localStorage): SSR hiçbir şey çizmez, hydration uyuşur.
  const consented = useSyncExternalStore(subscribeConsent, readConsentAll, () => false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded || !window.$crisp) return;
    window.$crisp.push(["do", consented ? "chat:show" : "chat:hide"]);
  }, [consented, loaded]);

  // Giriş yapmış kullanıcıyı Crisp'e bildir (kuyruğa; betik yüklenince işlenir).
  useEffect(() => {
    if (!loaded || !session?.user || !window.$crisp) return;
    if (session.user.email) window.$crisp.push(["set", "user:email", [session.user.email]]);
    if (session.user.name) window.$crisp.push(["set", "user:nickname", [session.user.name]]);
  }, [session, loaded]);

  if (!websiteId || !consented || loaded) return null;

  return (
    <button
      type="button"
      onClick={() => {
        loadCrispAndOpen(websiteId);
        setLoaded(true);
      }}
      aria-label={t("chatOpen")}
      className="fixed right-4 z-30 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 active:scale-95 cursor-pointer"
    >
      <MessageCircle size={24} aria-hidden />
    </button>
  );
}
