/** D5: KVKK disa aktarma istegi, araci basvurusu ve site baglantilari. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Mock } from "jest-mock";
import { ApiError } from "../api";
import { buildAffiliateApplication, dataExportRetryAt } from "../account-parity";
import { applyAffiliateOptions, dataExportOptions, myAffiliateKey } from "../queries";
import { sitePage } from "../site-page";
import { SITE_ORIGIN } from "../images";

const mockApi: Mock<(path: string, opts?: unknown) => Promise<unknown>> = jest.fn();
jest.mock("../api", () => {
  class ApiError extends Error {
    status: number;
    code: string;
    body?: unknown;
    constructor(status: number, code: string, body?: unknown) {
      super(code);
      this.status = status;
      this.code = code;
      this.body = body;
    }
  }
  return { api: (path: string, opts?: unknown) => mockApi(path, opts), ApiError, isImpersonating: () => false };
});
jest.mock("../auth", () => ({ useAuth: jest.fn() }));
jest.mock("../partner-shop", () => ({ usePartnerShopSelection: jest.fn(), withShop: (p: string) => p }));
jest.mock("../offline-tickets", () => ({ saveOfflineTicket: jest.fn(), deleteOfflineTicket: jest.fn() }));

beforeEach(() => {
  mockApi.mockReset();
  mockApi.mockResolvedValue({ ok: true });
});

describe("veri disa aktarma", () => {
  it("POST /account/data-export dili tasir", async () => {
    await dataExportOptions.mutationFn({ locale: "de" });
    expect(mockApi).toHaveBeenCalledWith("/account/data-export", { method: "POST", body: { locale: "de" } });
  });

  it("yalniz rate_limited yanitindan gecerli retryAt okunur", () => {
    expect(dataExportRetryAt(new ApiError(429, "rate_limited", { retryAt: "2026-11-25T10:00:00.000Z" }))).toBe(
      "2026-11-25T10:00:00.000Z",
    );
    expect(dataExportRetryAt(new ApiError(429, "rate_limited", { retryAt: "yarin" }))).toBeNull();
    expect(dataExportRetryAt(new ApiError(409, "no_verified_email", { retryAt: "2026-11-25T10:00:00.000Z" }))).toBeNull();
    expect(dataExportRetryAt(new Error("x"))).toBeNull();
  });
});

describe("araci basvurusu", () => {
  const base = { displayName: "  Ornek Ev  ", type: "airbnb_host" as const, email: "", phone: " 5320000000 ", note: " " };

  it("bosluklar kirpilir, bos alanlar gonderilmez", () => {
    expect(buildAffiliateApplication(base)).toEqual({
      ok: true,
      body: { displayName: "Ornek Ev", type: "airbnb_host", contactEmail: undefined, contactPhone: "5320000000", applicationNote: undefined },
    });
  });

  it("ad/tur eksikse ya da iletisim yoksa sunucuya gitmez", () => {
    expect(buildAffiliateApplication({ ...base, type: null })).toEqual({ ok: false, error: "invalid_data" });
    expect(buildAffiliateApplication({ ...base, displayName: "A" })).toEqual({ ok: false, error: "invalid_data" });
    expect(buildAffiliateApplication({ ...base, phone: "  " })).toEqual({ ok: false, error: "contact_required" });
  });

  it("POST /affiliate/apply; basarida yalniz bu kullanicinin paneli yenilenir", async () => {
    const qc = { invalidateQueries: jest.fn(async () => undefined) };
    const o = applyAffiliateOptions(qc, "u1");
    await o.mutationFn({ displayName: "Ornek Ev", type: "hotel", contactEmail: "a@example.test" });
    expect(mockApi).toHaveBeenCalledWith("/affiliate/apply", {
      method: "POST",
      body: { displayName: "Ornek Ev", type: "hotel", contactEmail: "a@example.test" },
    });
    o.onSuccess();
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: myAffiliateKey("u1") });
  });
});

describe("sitePage", () => {
  it("kullanicinin dili; sitede olmayan dil Ingilizceye duser", () => {
    expect(sitePage("cancellation", "de")).toBe(`${SITE_ORIGIN}/de/cancellation`);
    expect(sitePage("esnaf", "ru")).toBe(`${SITE_ORIGIN}/en/esnaf`);
  });
});
