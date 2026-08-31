"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { withTimeout } from "@/lib/async-timeout";

/**
 * VAPID public key (NEXT_PUBLIC_VAPID_PUBLIC_KEY) tanımlıysa push izni ister.
 */
/** Push worker'i: `public/push-sw.js`. `fetch` dinlemez, onbellek tutmaz. */
const PUSH_SW_PATH = "/push-sw.js";

/**
 * Kayit + etkinlesme icin ust sinir. Suresiz beklemek, dugmeyi kilitleyen
 * hatanin ta kendisiydi: bir ust sinir olmadan "basarisiz" hali hic olusmuyor.
 */
const SW_READY_TIMEOUT_MS = 10_000;

export default function WebPushOptIn() {
  const t = useTranslations("WebPush");
  const { data: session, status } = useSession();
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /**
   * Bu tarayıcıda ZATEN abonelik var mı?
   *
   * `null` = henüz bakılmadı. Bakılmadan kartı çizmek, aboneliği açmış
   * kullanıcıya her sayfa yenilemesinde aynı daveti göstermek olurdu — panelde
   * kalıcı bir gürültü, ve esnafın "bunu zaten yapmıştım" diye ikinci kez
   * tıklaması. Abonelik tarayıcıda duruyor, sunucuya sormaya gerek yok.
   */
  const [alreadySubscribed, setAlreadySubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        if (!cancelled) setAlreadySubscribed(false);
        return;
      }
      try {
        /*
          `getRegistration` KULLANILIYOR, `ready` DEĞİL: `ready` etkin bir kayıt
          yoksa HİÇ çözülmez ve bu etki sonsuza kadar askıda kalırdı — aşağıdaki
          `subscribe` yorumunda anlatılan hatanın aynısı.
        */
        const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_PATH);
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setAlreadySubscribed(Boolean(sub));
      } catch {
        // Tarayıcı izin vermiyorsa kartı göstermek doğru: kullanıcı deneyebilir.
        if (!cancelled) setAlreadySubscribed(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!vapid || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setMsg(t("unsupported"));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      /*
        SERVICE WORKER'I BURADA KAYDEDIYORUZ.

        Onceden `navigator.serviceWorker.ready` bekleniyordu. O soz, ETKIN bir
        kayit olmadan HIC cozulmez -- ve 2026-08-23'te eski worker kaldirildigi
        icin uygulamada hicbir kayit kalmamisti. Sonuc: dugmeye basan kullanici
        sonsuza kadar donen bir yukleme goruyordu; `finally` hic calismadigi
        icin dugme sayfa yenilenene kadar kilitli kaliyordu ve tek bir hata
        mesaji bile cikmiyordu.

        Worker yalnizca BURADA, kullanici bildirim istediginde kaydediliyor --
        yani hic istemeyen kullanicinin tarayicisinda service worker olmuyor.
      */
      const registration = await withTimeout(
        navigator.serviceWorker
          .register(PUSH_SW_PATH)
          .then(() => navigator.serviceWorker.ready),
        SW_READY_TIMEOUT_MS,
        "push_sw_ready",
      );

      const sub = await registration.pushManager.subscribe({
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
      setAlreadySubscribed(true);
    } catch {
      setMsg(t("permissionDenied"));
    } finally {
      setBusy(false);
    }
  }, [t, vapid]);

  /*
    `alreadySubscribed === null` -> henuz bakilmadi; kart CIZILMEZ. Once cizip
    sonra kaldirmak, sayfa acilisinda goz onunde bir zipllama uretirdi.
  */
  if (status !== "authenticated" || !session?.user?.id || !vapid) {
    return null;
  }
  if (alreadySubscribed !== false && msg === null) {
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
        className="mt-3 rounded-full bg-orange-600 px-4 py-2 text-xs id-eyebrow text-white disabled:opacity-50"
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
