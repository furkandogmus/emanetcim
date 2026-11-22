"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2, MessageCircle } from "lucide-react";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent-storage-key";

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
    /** Crisp betiği hazır olunca bunu çağırır (Crisp JS SDK sözleşmesi). */
    CRISP_READY_TRIGGER?: () => void;
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

/** Sohbet kutusunda odaklanabilir ilk öğe (Crisp'in kendi DOM'u). */
function crispFocusTarget(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    "#crisp-chatbox textarea, #crisp-chatbox [contenteditable='true'], #crisp-chatbox input",
  );
}

/**
 * Crisp'i bir kez yükler ve sohbeti açar. `onReady` Crisp hazır olunca,
 * `onError` betik inmezse çağrılır.
 */
export function loadCrispAndOpen(
  websiteId: string,
  { onReady, onError }: { onReady?: () => void; onError?: () => void } = {},
): void {
  window.$crisp = window.$crisp ?? [];
  window.CRISP_READY_TRIGGER = () => onReady?.();
  if (!document.querySelector("script[data-bagajpark-crisp]")) {
    window.CRISP_WEBSITE_ID = websiteId;
    const s = document.createElement("script");
    s.src = CRISP_SCRIPT_SRC;
    s.async = true;
    s.setAttribute("data-bagajpark-crisp", "1");
    s.addEventListener("error", () => {
      // Sonraki tıklama yeniden denesin.
      s.remove();
      onError?.();
    });
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
  /*
    idle: cephe · loading: betik iniyor, düğme aria-busy ve odak ÜZERİNDE kalır
    (eskiden düğme hemen kalkıyordu, odak body'ye düşüyor ve ekranda hiçbir şey
    olmuyordu) · handed: odak Crisp'e verildi, cephe kalkar · fallback: Crisp
    odak alamadı, düğme kalır ve sohbeti yeniden açar.
  */
  const [phase, setPhase] = useState<"idle" | "loading" | "handed" | "fallback">("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const loaded = phase !== "idle" && phase !== "loading";

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

  if (!websiteId || !consented || phase === "handed") return null;

  const busy = phase === "loading";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => {
        if (busy) return;
        if (phase === "fallback") {
          window.$crisp?.push(["do", "chat:open"]);
          return;
        }
        setPhase("loading");
        loadCrispAndOpen(websiteId, {
          onReady: () => {
            // Crisp sohbet kutusunu bir sonraki karede çiziyor.
            requestAnimationFrame(() => {
              const target = crispFocusTarget();
              if (target) {
                target.focus();
                setPhase("handed");
              } else {
                setPhase("fallback");
                buttonRef.current?.focus();
              }
            });
          },
          onError: () => setPhase("idle"),
        });
      }}
      aria-label={t("chatOpen")}
      aria-busy={busy || undefined}
      className="fixed right-4 z-30 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-5 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 active:scale-95 cursor-pointer"
    >
      {busy ? (
        <Loader2 size={24} className="animate-spin" aria-hidden />
      ) : (
        <MessageCircle size={24} aria-hidden />
      )}
    </button>
  );
}
