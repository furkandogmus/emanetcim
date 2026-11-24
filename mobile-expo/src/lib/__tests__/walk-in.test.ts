import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { walkInRequest, WALK_IN_PICKUP_HOURS } from "@/lib/walk-in";
import { appPathFromLink } from "@/lib/app-link-path";
import {
  POSTER_WINDOW_MS,
  clearPosterAttribution,
  loadPosterAttribution,
  rememberPosterSource,
} from "@/lib/pending-poster";

const mockStore = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  setItemAsync: (k: string, v: string) => Promise.resolve(void mockStore.set(k, v)),
  getItemAsync: (k: string) => Promise.resolve(mockStore.get(k) ?? null),
  deleteItemAsync: (k: string) => Promise.resolve(void mockStore.delete(k)),
}));

const SHOP = "0b7e3c1a-2f4d-4c8e-9a1b-3d5e7f9a1b2c";
const NOW = Date.parse("2026-11-25T10:00:00Z");
const FORM = { name: "Ada", phone: "", email: "", bags: "2", hours: 4, terms: true };

beforeEach(() => {
  clearPosterAttribution();
  mockStore.clear();
});

describe("walkInRequest", () => {
  it("gecerli form: alma saati simdiden secilen saat kadar sonra", () => {
    expect(walkInRequest(FORM, NOW)).toEqual({
      guestName: "Ada",
      bagCount: 2,
      pickupAt: "2026-11-25T14:00:00.000Z",
      termsConfirmed: true,
    });
    expect(WALK_IN_PICKUP_HOURS).toContain(4);
  });

  it("iletisim yalniz dolduruldugunda gider", () => {
    expect(walkInRequest({ ...FORM, phone: " +90 555 000 00 00 ", email: "a@b.co" }, NOW)).toMatchObject({
      guestPhone: "+90 555 000 00 00",
      guestEmail: "a@b.co",
    });
  });

  it.each([
    ["sartlar onaysiz", { terms: false }],
    ["kisa ad", { name: "A" }],
    ["sifir valiz", { bags: "0" }],
    ["bos valiz", { bags: "" }],
    ["bozuk e-posta", { email: "a@" }],
    ["kisa telefon", { phone: "12" }],
  ])("%s -> gonderilmez", (_l, over) => {
    expect(walkInRequest({ ...FORM, ...over }, NOW)).toBeNull();
  });
});

describe("afis atfi (uygulama)", () => {
  it("dukkan baglantisindaki kaynak=afis-<uuid> 30 dk saklanir", async () => {
    appPathFromLink(`https://bagajpark.com/tr/shop/${SHOP}?kaynak=afis-${SHOP}`);
    const got = await loadPosterAttribution();
    expect(got?.shopId).toBe(SHOP);
    expect(await loadPosterAttribution(Date.parse(got!.capturedAt) + POSTER_WINDOW_MS + 1)).toBeNull();
  });

  it("baska kaynak ya da bozuk kimlik saklanmaz", async () => {
    rememberPosterSource("web-home");
    rememberPosterSource("afis-shop00000001");
    expect(await loadPosterAttribution()).toBeNull();
  });

  it("son dokunus: yeni afis eskisinin yerini alir", async () => {
    const other = "11111111-2222-4333-8444-555555555555";
    rememberPosterSource(`afis-${SHOP}`, NOW);
    rememberPosterSource(`afis-${other}`, NOW + 1000);
    expect((await loadPosterAttribution(NOW + 2000))?.shopId).toBe(other);
  });
});
