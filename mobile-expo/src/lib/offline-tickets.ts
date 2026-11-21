import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { isImpersonating } from "./api";
import type { BookingDetail } from "./types";

/**
 * Aktif rezervasyonun bilet bilgisi cihazda saklanir: tezgahta internet yoksa
 * (dolasimdaki turist) QR yine acilir. Eskiden ag hatasinda yalnizca "Geri"
 * dugmeli bir hata ekrani cikiyordu. Yalnizca bilet alanlari saklanir (kucuk:
 * SecureStore buyuk degerleri iOS'ta reddedebilir); cikista silinir.
 */
export type OfflineTicket = Pick<
  BookingDetail,
  "id" | "shopId" | "shopName" | "checkInTime" | "checkOutTime" | "bagCountS" | "bagCountM" | "bagCountXl" | "totalPrice" | "status" | "qrCodeToken"
>;

const INDEX_KEY = "offline_tickets";
const key = (id: string) => `ticket_${id}`;
const ACTIVE = new Set(["APPROVED", "PAID", "CHECKED_IN"]);

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function saveOfflineTicket(b: BookingDetail): Promise<void> {
  // Goruntulemede hedefin QR'i admin cihazinda kalmasin (uygulama oldurulse bile).
  if (isImpersonating()) return;
  const ids = (await readIndex()).filter((x) => x !== b.id);
  if (!ACTIVE.has(b.status) || !b.qrCodeToken) {
    await SecureStore.deleteItemAsync(key(b.id)).catch(() => undefined);
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids)).catch(() => undefined);
    return;
  }
  const ticket: OfflineTicket = {
    id: b.id,
    shopId: b.shopId,
    shopName: b.shopName,
    checkInTime: b.checkInTime,
    checkOutTime: b.checkOutTime,
    bagCountS: b.bagCountS,
    bagCountM: b.bagCountM,
    bagCountXl: b.bagCountXl,
    totalPrice: b.totalPrice,
    status: b.status,
    qrCodeToken: b.qrCodeToken,
  };
  await SecureStore.setItemAsync(key(b.id), JSON.stringify(ticket)).catch(() => undefined);
  // En fazla 5 bilet: eskiler silinir.
  const next = [b.id, ...ids];
  for (const old of next.slice(5)) await SecureStore.deleteItemAsync(key(old)).catch(() => undefined);
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(next.slice(0, 5))).catch(() => undefined);
}

/** Tek bir biletin silinmesi: sunucu rezervasyonu artik vermiyorsa (404/403) eski QR kalmasin. */
export async function deleteOfflineTicket(id: string): Promise<void> {
  const ids = (await readIndex()).filter((x) => x !== id);
  await SecureStore.deleteItemAsync(key(id)).catch(() => undefined);
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids)).catch(() => undefined);
}

/**
 * Cihazdaki biletler, en yeni kaydedilen once. Liste ekranlari sunucuya
 * ulasamayinca bunlari gosterir: bilet yalnizca tek bir detay ekraninin icinden
 * erisilebilirse, internetsiz acilista o ekrana giden satir hic gelmiyordu.
 * Goruntuleme (impersonation) sirasinda bos doner: baska kullanicinin bileti.
 */
export async function listOfflineTickets(): Promise<OfflineTicket[]> {
  if (isImpersonating()) return [];
  const out: OfflineTicket[] = [];
  for (const id of await readIndex()) {
    const t = await loadOfflineTicket(id);
    if (t) out.push(t);
  }
  return out;
}

/** `enabled` iken (liste sorgusu hata verdiginde) cihazdaki biletleri okur. */
export function useOfflineTickets(enabled: boolean): OfflineTicket[] {
  const [tickets, setTickets] = useState<OfflineTicket[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void listOfflineTickets().then((t) => alive && setTickets(t));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? tickets : [];
}

export async function loadOfflineTicket(id: string): Promise<OfflineTicket | null> {
  const raw = await SecureStore.getItemAsync(key(id)).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as OfflineTicket) : null;
  } catch {
    return null;
  }
}

/** Cikista: bir sonraki hesap oncekinin biletlerini gormesin. */
export async function clearOfflineTickets(): Promise<void> {
  for (const id of await readIndex()) await SecureStore.deleteItemAsync(key(id)).catch(() => undefined);
  await SecureStore.deleteItemAsync(INDEX_KEY).catch(() => undefined);
}
