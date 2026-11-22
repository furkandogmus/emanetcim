/**
 * Esnaf aramasi sunucuda: yazma durunca tek istek, terim ve dukkan sunucuya gider,
 * bos/kisa terimde istek yok (ekran normal sekme listesini gosterir).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { PARTNER_SEARCH_DEBOUNCE_MS, usePartnerBookingSearch } from "../queries";
import { refineServerSearch } from "../booking-search";
import type { PartnerBooking } from "../types";

jest.setTimeout(20_000);

const mockApi = jest.fn(async (_path: string) => ({ items: [], total: 0, page: 1, limit: 50, nextCursor: null }));
jest.mock("../api", () => ({
  api: (path: string) => mockApi(path),
  ApiError: class extends Error {},
  isImpersonating: () => false,
}));
jest.mock("../auth", () => ({ useAuth: () => ({ state: { status: "signedIn" } }) }));
jest.mock("expo-secure-store", () => ({}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function setup(initial: string, shopId: string | null = null) {
  return renderHook(({ q, shop }: { q: string; shop: string | null }) => usePartnerBookingSearch(q, shop), {
    wrapper,
    initialProps: { q: initial, shop: shopId },
  });
}

const searchCalls = () => mockApi.mock.calls.map((c) => c[0]).filter((p) => p.includes("q="));

beforeEach(() => {
  jest.useFakeTimers();
  mockApi.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("usePartnerBookingSearch", () => {
  it("yazma durmadan istek atmaz; durunca son terimle tek istek atar", async () => {
    const view = await setup("");
    await view.rerender({ q: "an", shop: null });
    await view.rerender({ q: "ann", shop: null });
    await act(async () => {
      jest.advanceTimersByTime(PARTNER_SEARCH_DEBOUNCE_MS - 50);
    });
    expect(searchCalls()).toHaveLength(0);
    expect(view.result.current.pending).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(searchCalls()).toEqual(["/partner/bookings?q=ann&limit=50"]);
    expect(view.result.current.term).toBe("ann");
    expect(view.result.current.pending).toBe(false);
  });

  it("q ve secili dukkani sunucuya iletir; fisteki # atilir", async () => {
    await setup("#ABCD1234", "shop-2");
    await act(async () => {
      jest.advanceTimersByTime(PARTNER_SEARCH_DEBOUNCE_MS);
    });
    expect(searchCalls()).toEqual(["/partner/bookings?q=ABCD1234&limit=50&shopId=shop-2"]);
  });

  it("bos ya da tek karakterlik terimde istek yok, terim bos: normal liste kalir", async () => {
    const view = await setup("");
    expect(view.result.current.term).toBe("");
    await view.rerender({ q: "a", shop: null });
    await act(async () => {
      jest.advanceTimersByTime(PARTNER_SEARCH_DEBOUNCE_MS * 3);
    });
    expect(mockApi).not.toHaveBeenCalled();
    expect(view.result.current.term).toBe("");
  });

  it("kutu temizlenince beklemeden bos terime doner", async () => {
    const view = await setup("anna");
    await act(async () => {
      jest.advanceTimersByTime(PARTNER_SEARCH_DEBOUNCE_MS);
    });
    await view.rerender({ q: "", shop: null });
    expect(view.result.current.term).toBe("");
    expect(view.result.current.pending).toBe(false);
  });
});

describe("refineServerSearch (q'yu bilmeyen eski sunucu)", () => {
  const rows = [
    { id: "abcd1234-0000", guestName: "Anna Schmidt" },
    { id: "ffff0000-0000", guestName: "John Smith" },
  ] as PartnerBooking[];

  it("tum listeyi donen eski sunucuda yalnizca eslesenler kalir", () => {
    expect(refineServerSearch(rows, "anna").map((r) => r.id)).toEqual(["abcd1234-0000"]);
  });

  it("telefon gibi terimde sunucuya guvenilir (eslesme satirda olmayan telefondan)", () => {
    expect(refineServerSearch(rows, "5551234")).toHaveLength(2);
  });
});
