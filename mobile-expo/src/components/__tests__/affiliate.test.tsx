/**
 * Araci (referans) kodu: derin baglantidan yakalanir, odeme ekrani sunucunun
 * onizlemesini gosterir ve kodu rezervasyona iletir; fiyat istemcide
 * hesaplanmaz. Yonetim ekrani bekleyen araciyi onaylar, hata kodunu cevirir.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import CheckoutScreen from "@/app/(guest)/checkout";
import AdminAffiliatesScreen from "@/app/(admin)/admin/affiliates";
import { appPathFromLink } from "@/lib/app-link-path";
import { clearPendingReferral, loadPendingReferral, rememberReferral } from "@/lib/pending-referral";
import { ApiError } from "@/lib/api";
import i18n from "@/lib/i18n";
import type { AdminAffiliate } from "@/lib/types";

jest.setTimeout(20_000);

const mockStore: Record<string, string> = {};
jest.mock("expo-secure-store", () => ({
  setItemAsync: async (k: string, v: string) => {
    mockStore[k] = v;
  },
  getItemAsync: async (k: string) => mockStore[k] ?? null,
  deleteItemAsync: async (k: string) => {
    delete mockStore[k];
  },
}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: (...a: unknown[]) => mockReplace(...a), canGoBack: () => true },
  useLocalSearchParams: () => ({ shopId: "shop-1" }),
  Redirect: () => null,
}));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: {} }));
jest.mock("@/lib/auth", () => ({ useAuth: () => ({ state: { status: "signedIn", user: { id: "a1", role: "ADMIN" } } }) }));
jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/components/StackHeader", () => ({ StackHeader: () => null }));
jest.mock("@/lib/search", () => ({
  useSearch: () => ({
    checkIn: new Date("2030-01-01T10:00:00.000Z"),
    checkOut: new Date("2030-01-01T18:00:00.000Z"),
    bags: { s: 1, m: 0, xl: 0 },
  }),
  totalBags: (b: { s: number; m: number; xl: number }) => b.s + b.m + b.xl,
}));
jest.mock("@/lib/queries", () => {
  const actual = jest.requireActual<typeof import("@/lib/queries")>("@/lib/queries");
  return {
    ...actual,
    useOnlinePayments: () => false,
    useShop: () => ({ isLoading: false, data: { id: "shop-1", name: "Ornek Dukkan" } }),
  };
});

type Call = { path: string; method?: string; body?: Record<string, unknown> };
const mockCalls: Call[] = [];
let mockHandler: (c: Call) => Promise<unknown> = async () => ({});
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (path: string, opts: { method?: string; body?: Record<string, unknown> } = {}) => {
      const c = { path, method: opts.method, body: opts.body };
      mockCalls.push(c);
      return mockHandler(c);
    },
  };
});

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  mockCalls.length = 0;
  mockReplace.mockClear();
  clearPendingReferral();
});
afterEach(() => qc.clear());

describe("derin baglanti ?aff=", () => {
  it("dukkan baglantisindaki araci kodu saklanir, buyuk harfe cevrilir", async () => {
    expect(appPathFromLink("https://bagajpark.com/tr/shop/abc?aff=ahmet-ev")).toBe("/shop/abc");
    expect(await loadPendingReferral()).toBe("AHMET-EV");
  });

  it("?ref= kullanici davet kodudur: araci alanina tasinmaz", async () => {
    expect(appPathFromLink("https://bagajpark.com/tr/shop/abc?ref=ABCD2345")).toBe("/shop/abc");
    expect(await loadPendingReferral()).toBeNull();
  });

  it("gecersiz bicim yok sayilir; 30 gun sonra kod dusar", async () => {
    rememberReferral("<script>");
    expect(await loadPendingReferral()).toBeNull();
    rememberReferral("OTEL-X", 0);
    expect(await loadPendingReferral(31 * 24 * 60 * 60 * 1000)).toBeNull();
  });
});

const QUOTE = {
  days: 1,
  lines: [{ size: "s", count: 1, days: 1, amount: 300 }],
  insuranceFee: 0,
  subtotal: 300,
  total: 270,
  discount: { kind: "affiliate", code: "AHMET-EV", amount: 30 },
  codeStatus: null,
  minPrice: null,
  affiliate: { code: "AHMET-EV", status: "applied", ratePct: 10, amount: 30 },
  checkInTime: "2030-01-01T10:00:00.000Z",
  checkOutTime: "2030-01-01T18:00:00.000Z",
  hoursNotice: null,
};

describe("odeme ekrani referans kodu", () => {
  it("derin baglantidan gelen kodu sunucuya sorar, indirimi sunucudan gosterir ve rezervasyona iletir", async () => {
    rememberReferral("AHMET-EV");
    mockHandler = async ({ path, body }) => {
      if (path === "/checkout/quote") return body?.affiliateCode ? QUOTE : { ...QUOTE, total: 300, discount: null, affiliate: null };
      if (path === "/checkout/intent") return { bookingId: "b1", status: "APPROVED", totalPrice: 270 };
      return {};
    };
    await render(<CheckoutScreen />, { wrapper });
    await screen.findByText(i18n.t("checkout.affiliate.line", { code: "AHMET-EV" }));
    expect(screen.getByText(i18n.t("checkout.affiliate.applied", { pct: 10 }))).toBeTruthy();
    await fireEvent.press(screen.getByText(i18n.t("checkout.confirm")));
    await waitFor(() => expect(mockCalls.some((c) => c.path === "/checkout/intent")).toBe(true));
    const intent = mockCalls.find((c) => c.path === "/checkout/intent")!;
    expect(intent.body).toMatchObject({ affiliateCode: "AHMET-EV", expectedTotal: 270 });
    expect(await loadPendingReferral()).toBeNull();
  });

  it("sunucu kodu reddederse rezervasyona gitmez ve hata gosterilir", async () => {
    rememberReferral("YOK-KOD");
    mockHandler = async ({ path }) => {
      if (path === "/checkout/quote")
        return { ...QUOTE, total: 300, discount: null, affiliate: { code: "YOK-KOD", status: "invalid", ratePct: 0, amount: 0 } };
      if (path === "/checkout/intent") return { bookingId: "b1", status: "APPROVED", totalPrice: 300 };
      return {};
    };
    await render(<CheckoutScreen />, { wrapper });
    await screen.findByText(i18n.t("checkout.affiliate.invalid"));
    await fireEvent.press(screen.getByText(i18n.t("checkout.confirm")));
    await waitFor(() => expect(mockCalls.some((c) => c.path === "/checkout/intent")).toBe(true));
    expect(mockCalls.find((c) => c.path === "/checkout/intent")!.body).not.toHaveProperty("affiliateCode");
  });
});

describe("odeme ekrani: kod + referans birlikte", () => {
  it("referans kodu sonradan eklenince uygulanan indirim kodu DUSMEZ, onunla yeniden sorulur", async () => {
    mockHandler = async ({ path, body }) => {
      if (path !== "/checkout/quote") return {};
      if (body?.code)
        return { ...QUOTE, total: 280, discount: { kind: "coupon", code: "YAZ20", amount: 20 }, codeStatus: "applied", affiliate: body.affiliateCode ? { ...QUOTE.affiliate, status: "attributed", amount: 0 } : null };
      return { ...QUOTE, total: 300, discount: null, affiliate: null };
    };
    await render(<CheckoutScreen />, { wrapper });
    await fireEvent.press(await screen.findByText(i18n.t("checkout.code.prompt")));
    await fireEvent.changeText(screen.getByLabelText(i18n.t("checkout.code.label")), "YAZ20");
    await fireEvent.press(screen.getByText(i18n.t("checkout.apply")));
    await screen.findByText(i18n.t("checkout.code.couponLine", { code: "YAZ20" }));
    await fireEvent.press(screen.getByText(i18n.t("checkout.affiliate.prompt")));
    await fireEvent.changeText(screen.getByLabelText(i18n.t("checkout.affiliate.label")), "ahmet-ev");
    const applies = screen.getAllByText(i18n.t("checkout.apply"));
    await fireEvent.press(applies[applies.length - 1]);
    await waitFor(() =>
      expect(mockCalls.some((c) => c.path === "/checkout/quote" && c.body?.code === "YAZ20" && c.body?.affiliateCode === "AHMET-EV")).toBe(true),
    );
    expect(await screen.findByText(i18n.t("checkout.code.couponLine", { code: "YAZ20" }))).toBeTruthy();
  });

  it("ag hatasinda referans karti 'gecersiz' demez, hata ve tekrar dene gosterir", async () => {
    rememberReferral("AHMET-EV");
    mockHandler = async ({ path }) => {
      if (path === "/checkout/quote") throw new ApiError(0, "network");
      return {};
    };
    await render(<CheckoutScreen />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(i18n.t("common.networkError")).length).toBeGreaterThan(0));
    expect(screen.queryByText(i18n.t("checkout.affiliate.invalid"))).toBeNull();
    expect(screen.getAllByText(i18n.t("common.retry")).length).toBeGreaterThan(0);
  });
});

const PENDING: AdminAffiliate = {
  id: "aff-1",
  code: "ORNEK-OTEL",
  displayName: "Ornek Otel",
  type: "hotel",
  status: "pending",
  contactEmail: "otel@example.test",
  contactPhone: null,
  commissionRate: 10,
  guestDiscountRate: 0,
  notes: null,
  applicationNote: "Resepsiyonda QR",
  linkedUserEmail: null,
  createdAt: "2026-11-23T10:00:00.000Z",
  stats: { clicks: 3, bookings: 1, completedBookings: 0, earned: 0, unpaid: 0, paid: 0 },
};

describe("yonetim: aracilar", () => {
  it("bekleyen araciyi onaylar (durum active)", async () => {
    mockHandler = async ({ path, method }) =>
      path === "/admin/affiliates" && !method ? { items: [PENDING] } : { success: true };
    await render(<AdminAffiliatesScreen />, { wrapper });
    await fireEvent.press(await screen.findByText(i18n.t("adminOps.affiliates.approve")));
    await waitFor(() => expect(mockCalls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = mockCalls.find((c) => c.method === "PATCH")!;
    expect(patch.path).toBe("/admin/affiliates/aff-1");
    expect(patch.body).toMatchObject({ status: "active", code: "ORNEK-OTEL", commissionRate: 10 });
  });

  it("sunucu hata kodu cevrilir (ham metin basilmaz)", async () => {
    mockHandler = async ({ path, method }) => {
      if (path === "/admin/affiliates" && method === "POST") throw new ApiError(409, "duplicate_code");
      return { items: [] };
    };
    await render(<AdminAffiliatesScreen />, { wrapper });
    await fireEvent.changeText(await screen.findByLabelText(i18n.t("adminOps.affiliates.displayName")), "Ornek Rehber");
    await fireEvent.press(screen.getByText(i18n.t("adminOps.affiliates.submit")));
    expect(await screen.findByText(i18n.t("adminOps.affiliates.errors.duplicate_code"))).toBeTruthy();
  });
});
