/**
 * Yonetim islemlerinin istekleri: dogru uc, dogru govde ve basarida da hatada da
 * yenilenen sorgular.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Mock } from "jest-mock";
import { adminBookingActionOptions, partnerCancelOptions, partnerNoShowOptions } from "../queries";

const mockApi: Mock<(path: string, opts?: unknown) => Promise<unknown>> = jest.fn();
jest.mock("../api", () => ({
  api: (path: string, opts?: unknown) => mockApi(path, opts),
  ApiError: class extends Error {},
  isImpersonating: () => false,
}));
jest.mock("../auth", () => ({ useAuth: jest.fn() }));
jest.mock("../partner-shop", () => ({ usePartnerShopSelection: jest.fn(), withShop: (p: string) => p }));
jest.mock("../offline-tickets", () => ({ saveOfflineTicket: jest.fn(), deleteOfflineTicket: jest.fn() }));

const qc = { invalidateQueries: jest.fn(async () => undefined) };
const invalidated = () => qc.invalidateQueries.mock.calls.map((c) => JSON.stringify((c as unknown[])[0]));

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue({ success: true });
  qc.invalidateQueries.mockClear();
});

describe("yonetici islemleri", () => {
  it("iptal: POST /admin/bookings/:id/cancel, not kirpilir", async () => {
    const o = adminBookingActionOptions(qc, "b/1");
    await o.mutationFn({ action: "cancel", note: "  misafir aradi  " });
    expect(mockApi).toHaveBeenCalledWith("/admin/bookings/b%2F1/cancel", { method: "POST", body: { note: "misafir aradi" } });
  });

  it("zorla teslim: POST /admin/bookings/:id/force-checkout", async () => {
    await adminBookingActionOptions(qc, "b1").mutationFn({ action: "forceCheckout", note: "valiz verildi" });
    expect(mockApi).toHaveBeenCalledWith("/admin/bookings/b1/force-checkout", { method: "POST", body: { note: "valiz verildi" } });
  });

  it("sonucta detay, listeler, sayaclar ve ozet yenilenir", () => {
    adminBookingActionOptions(qc, "b1").onSettled();
    expect(invalidated()).toEqual(
      expect.arrayContaining([
        JSON.stringify({ queryKey: ["admin", "booking", "b1"] }),
        JSON.stringify({ queryKey: ["admin", "bookings"] }),
        JSON.stringify({ queryKey: ["admin", "overview"] }),
      ]),
    );
  });

  it("hata yukari tasinir (ekran kodu cevirir)", async () => {
    mockApi.mockRejectedValueOnce(new Error("invalid_status"));
    await expect(adminBookingActionOptions(qc, "b1").mutationFn({ action: "cancel", note: "xxxxx" })).rejects.toThrow("invalid_status");
  });
});

describe("esnaf islemleri", () => {
  it("iptal: neden ve not govdede", async () => {
    await partnerCancelOptions(qc, "b1").mutationFn({ reason: "other", note: "su kesik" });
    expect(mockApi).toHaveBeenCalledWith("/partner/bookings/b1/cancel", {
      method: "POST",
      body: { reason: "other", note: "su kesik" },
    });
  });

  it("gelmedi: bos govdeyle POST", async () => {
    await partnerNoShowOptions(qc, "b1").mutationFn();
    expect(mockApi).toHaveBeenCalledWith("/partner/bookings/b1/no-show", { method: "POST", body: {} });
  });

  it("sonucta rezervasyon ve esnaf listeleri yenilenir", () => {
    partnerNoShowOptions(qc, "b1").onSettled();
    expect(invalidated()).toEqual([JSON.stringify({ queryKey: ["bookings"] }), JSON.stringify({ queryKey: ["partner"] })]);
  });
});
