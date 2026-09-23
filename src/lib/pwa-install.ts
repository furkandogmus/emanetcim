/**
 * PWA kurulum davetinin ne zaman ve kime gosterilecegi.
 *
 * NEDEN (2026-09-23):
 *  - Davet yalnizca `beforeinstallprompt` ile aciliyordu; o olay Safari'de
 *    YOK. iPhone kullanicilari (turist kitlesinin buyuk kismi) daveti hic
 *    gormuyordu -- ustelik iOS'ta web push yalnizca ana ekrana eklenmis
 *    uygulamada calisir.
 *  - Davet ilk ziyarette, niyet olusmadan cikiyordu ve "Simdi degil" onu
 *    KALICI kapatiyordu. Artik ikinci ziyarette ya da rezervasyondan hemen
 *    sonra (QR'in ana ekranda durmasi en cok o an ise yarar) cikiyor;
 *    kapatilirsa 30 gun sonra yeniden soruluyor.
 *
 * Depo erisimi gizli pencerede firlatabilir; her erisim try/catch icinde.
 */
export const PWA_BOOKED_EVENT = "bagajpark:booked";
export const REASK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const DISMISS_KEY = "bagajpark-pwa-install-dismissed";
const BOOKED_KEY = "bagajpark-pwa-booked";
const VISITS_KEY = "bagajpark-pwa-visits";
const SESSION_KEY = "bagajpark-pwa-session-counted";

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    // depo yok: davet bu oturumda yine gosterilebilir, zarari yok
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** Kapatildi mi? Eski surum "1" yaziyordu: bugun kapatilmis sayilir ve 30 gun sonra yeniden sorulur. */
export function isInstallDismissed(now = Date.now()): boolean {
  const raw = read(local, DISMISS_KEY);
  if (!raw) return false;
  if (raw === "1") {
    write(local, DISMISS_KEY, String(now));
    return true;
  }
  const at = Number(raw);
  return Number.isFinite(at) && now - at < REASK_AFTER_MS;
}

export function dismissInstall(now = Date.now()): void {
  write(local, DISMISS_KEY, String(now));
}

/** Rezervasyon tamamlandi: davet hemen, rezervasyon metniyle acilir. */
export function markBooked(): void {
  write(local, BOOKED_KEY, "1");
  window.dispatchEvent(new Event(PWA_BOOKED_EVENT));
}

export function hasBooked(): boolean {
  return read(local, BOOKED_KEY) === "1";
}

/** Oturum basina bir kez sayar; kacinci ziyaret oldugunu dondurur. */
export function countVisit(): number {
  const visits = Number(read(local, VISITS_KEY) ?? "0") || 0;
  if (read(session, SESSION_KEY)) return visits;
  write(session, SESSION_KEY, "1");
  write(local, VISITS_KEY, String(visits + 1));
  return visits + 1;
}

export function isInstallEligible(booked: boolean, visits: number): boolean {
  return booked || visits >= 2;
}

/** iPhone/iPod/iPad; iPadOS 13+ kendini Mac olarak tanitir, dokunmatik noktadan ayrilir. */
export function isIosDevice(ua: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}
