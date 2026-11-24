import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { appPathFromLink } from "@/lib/app-link-path";
import {
  clearPendingInvite,
  clearPendingReferral,
  loadPendingInvite,
  loadPendingReferral,
} from "@/lib/pending-referral";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  setItemAsync: (k: string, v: string) => Promise.resolve(void mockStore.set(k, v)),
  getItemAsync: (k: string) => Promise.resolve(mockStore.get(k) ?? null),
  deleteItemAsync: (k: string) => Promise.resolve(void mockStore.delete(k)),
}));

const BK = "0f8fad5b-d9cb-469f-a165-70867728950e";

beforeEach(() => {
  clearPendingInvite();
  clearPendingReferral();
  mockStore.clear();
});

describe("appPathFromLink", () => {
  it.each([
    ["https://bagajpark.com/tr/shop/cmabc123", "/shop/cmabc123"],
    ["https://www.bagajpark.com/en/shop/cmabc123?x=1", "/shop/cmabc123"],
    [`https://bagajpark.com/tr/bookings/${BK}`, `/link?kind=booking&id=${BK}`],
    [`https://bagajpark.com/de/partner/bookings/${BK}`, `/link?kind=partner-booking&id=${BK}`],
    ["https://bagajpark.com/tr/account/affiliate", "/link?kind=affiliate"],
    ["https://bagajpark.com/tr/register", "/link?kind=register"],
    ["https://bagajpark.com/tr/register?ref=abcd2345", "/link?kind=register"],
    ["https://bagajpark.com/tr/register?role=PARTNER&ref=ABCD2345", "/link?kind=partner-invite&id=ABCD2345"],
    ["https://bagajpark.com/tr/register?role=partner", "/link?kind=partner-invite"],
    ["https://bagajpark.com/tr/register?partnerref=ABCD2345", "/link?kind=partner-invite&id=ABCD2345"],
    // Hesapsiz misafir ve jetonlu akislar webde; Android'de gelirse ana ekran.
    ["https://bagajpark.com/tr/bookings/lookup", "/"],
    ["https://bagajpark.com/tr/bookings/manage/eyJhbGciOi", "/"],
    [`https://bagajpark.com/tr/bookings/${BK}/dispute`, "/"],
    ["https://bagajpark.com/tr/auth/new-password?token=x", "/"],
    ["https://bagajpark.com/tr/auth/verify-email?token=x", "/"],
    ["https://bagajpark.com/tr/account", "/"],
    // Rezervasyon kimligi UUID olmali: rota adlari ekran acmaz.
    ["https://bagajpark.com/tr/bookings/settings", "/"],
    ["https://bagajpark.com/tr/bookings/modify", "/"],
    ["https://bagajpark.com/tr/partner/bookings/earnings", "/"],
  ])("%s -> %s", (link, path) => {
    expect(appPathFromLink(link)).toBe(path);
  });

  it("uygulama ici ve yabanci yollar degismez", () => {
    expect(appPathFromLink("/shop/abc")).toBe("/shop/abc");
    expect(appPathFromLink("bagajpark://bookings/1")).toBe("bagajpark://bookings/1");
    expect(appPathFromLink("https://example.com/tr/shop/abc")).toBe("https://example.com/tr/shop/abc");
  });

  it("davet kodu indirim alanina, araci kodu araci alanina saklanir", async () => {
    appPathFromLink("https://bagajpark.com/tr/register?ref=abcd2345");
    await expect(loadPendingInvite()).resolves.toBe("ABCD2345");
    await expect(loadPendingReferral()).resolves.toBeNull();

    appPathFromLink("https://bagajpark.com/tr/shop/cmabc123?aff=otel-1");
    await expect(loadPendingReferral()).resolves.toBe("OTEL-1");
    await expect(loadPendingInvite()).resolves.toBe("ABCD2345");
  });

  it("esnaf davetinin kodu misafir indirimi olarak saklanmaz", async () => {
    appPathFromLink("https://bagajpark.com/tr/register?role=PARTNER&ref=ABCD2345");
    await expect(loadPendingInvite()).resolves.toBeNull();
  });

  it("bozuk kod saklanmaz", async () => {
    appPathFromLink("https://bagajpark.com/tr/register?ref=%3Cscript%3E");
    await expect(loadPendingInvite()).resolves.toBeNull();
  });

  it("davet kodu 30 gunde duser", async () => {
    appPathFromLink("https://bagajpark.com/tr/register?ref=ABCD2345");
    const saved = Date.now();
    await expect(loadPendingInvite(saved + 29 * 86_400_000)).resolves.toBe("ABCD2345");
    await expect(loadPendingInvite(saved + 31 * 86_400_000)).resolves.toBeNull();
  });
});
