import * as SecureStore from "expo-secure-store";

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
