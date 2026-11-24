"use client";

import { getSession, signOut, type SignOutParams } from "next-auth/react";
import { WEB_IMPERSONATION_STOP_PATH } from "@/lib/web-impersonation-paths";

/**
 * Tarayici web push aboneligi ile oturum sahibini eslestirir. Abonelik tarayiciya
 * aittir, kullaniciya degil: ortak bir bilgisayarda A cikip B girdiginde abonelik A'ya
 * bagli kalirsa A'nin bildirimleri (rezervasyon bagiyla) B'nin ekranina duser.
 */

/** Push worker'i (`WebPushOptIn` ile ayni yol). */
const PUSH_SW_PATH = "/push-sw.js";
const REQUEST_TIMEOUT_MS = 3_000;

export async function currentBrowserPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(PUSH_SW_PATH);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? sub.toJSON() : null;
}

async function sendSubscription(method: "POST" | "DELETE", body: unknown): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch("/api/push/subscribe", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return r.ok;
  } finally {
    clearTimeout(timer);
  }
}

/** Giriste: bu tarayicinin aboneligini oturumdaki kullaniciya baglar (sunucu endpoint'e gore upsert eder). */
export async function rebindBrowserPush(): Promise<boolean> {
  const sub = await currentBrowserPushSubscription();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  return sendSubscription("POST", { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
}

/** Cikista: aboneligi sunucudan siler. Oturum henuz acikken cagrilmali. */
export async function unbindBrowserPush(): Promise<boolean> {
  const sub = await currentBrowserPushSubscription();
  if (!sub?.endpoint) return false;
  return sendSubscription("DELETE", { endpoint: sub.endpoint });
}

/*
  "Olarak goruntule" acikken oturum hedefin ve sunucu abonelik silmeyi reddeder: once
  goruntuleme durdurulur, DELETE geri gelen admin oturumuyla gider. Yoksa abonelik
  cikistan sonra da adminin hesabina bagli kalirdi.
*/
async function stopImpersonationIfActive(): Promise<void> {
  const session = await getSession();
  if (!session?.impersonation) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    await fetch(WEB_IMPERSONATION_STOP_PATH, { method: "POST", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** `signOut` yerine: once (varsa) goruntuleme biter, sonra abonelik ayrilir; hata ya da zaman asimi cikisi engellemez. */
export async function signOutWithPush(params?: SignOutParams<true>): Promise<void> {
  await stopImpersonationIfActive().catch(() => undefined);
  await unbindBrowserPush().catch(() => false);
  await signOut(params);
}
