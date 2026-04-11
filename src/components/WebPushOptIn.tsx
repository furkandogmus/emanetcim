"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

/**
 * VAPID public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY) tanımlıysa push izni ister.
 */
export default function WebPushOptIn() {
  const t = useTranslations("WebPush");
  const { data: session, status } = useSession();
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const subscribe = useCallback(async () => {
    if (!vapid || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setMsg(t("unsupported"));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setMsg(t("invalidSubscription"));
        return;
      }
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
      if (!r.ok) {
        setMsg(t("saveFailed"));
        return;
      }
      setMsg(t("enabled"));
    } catch {
      setMsg(t("permissionDenied"));
    } finally {
      setBusy(false);
    }
  }, [t, vapid]);

  if (status !== "authenticated" || !session?.user?.id || !vapid) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-700 shadow-sm">
      <p className="font-bold text-gray-900">{t("title")}</p>
      <p className="mt-1 text-xs text-gray-500">{t("description")}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void subscribe()}
        className="mt-3 rounded-full bg-orange-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
      >
        {busy ? "…" : t("enable")}
      </button>
      {msg ? <p className="mt-2 text-xs text-gray-600">{msg}</p> : null}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}
