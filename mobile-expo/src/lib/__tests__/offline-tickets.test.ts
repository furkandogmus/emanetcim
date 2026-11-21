import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
    __store: store,
  };
});

let mockImpersonating = false;
jest.mock("../api", () => ({ isImpersonating: () => mockImpersonating }));

import * as SecureStore from "expo-secure-store";

import { deleteOfflineTicket, listOfflineTickets, saveOfflineTicket } from "../offline-tickets";
import type { BookingDetail } from "../types";

const booking = (id: string, over: Partial<BookingDetail> = {}) =>
  ({
    id,
    shopId: "s1",
    shopName: "Dukkan",
    checkInTime: "2030-01-01T10:00:00Z",
    checkOutTime: "2030-01-02T10:00:00Z",
    bagCountS: 1,
    bagCountM: 0,
    bagCountXl: 0,
    totalPrice: 100,
    status: "APPROVED",
    qrCodeToken: `tok-${id}`,
    ...over,
  }) as BookingDetail;

beforeEach(() => {
  mockImpersonating = false;
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("cihazdaki biletler", () => {
  it("kaydedilen biletler listelenir, en yeni once", async () => {
    await saveOfflineTicket(booking("a"));
    await saveOfflineTicket(booking("b"));
    expect((await listOfflineTickets()).map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("aktif olmayan rezervasyon bilet olarak tutulmaz", async () => {
    await saveOfflineTicket(booking("a", { status: "CANCELLED" }));
    expect(await listOfflineTickets()).toEqual([]);
  });

  it("silinen bilet listeden kalkar", async () => {
    await saveOfflineTicket(booking("a"));
    await deleteOfflineTicket("a");
    expect(await listOfflineTickets()).toEqual([]);
  });

  it("goruntuleme (impersonation) sirasinda bos doner", async () => {
    await saveOfflineTicket(booking("a"));
    mockImpersonating = true;
    expect(await listOfflineTickets()).toEqual([]);
  });
});
