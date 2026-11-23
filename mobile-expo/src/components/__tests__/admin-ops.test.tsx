/**
 * Yonetim araclari: goruntuleme oturumunda yazma kapali, riskli ayar/bayrak yazarak
 * onaysiz gitmez (ifade birebir), her sunucu hata kodu cevrilir, kupon formu sunucu
 * semasiyla ayni sinirlari uygular, Ozet ekrani araclara baglanir.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import AdminDashboardScreen from "@/app/(admin)/admin/(tabs)/index";
import AdminCouponsScreen from "@/app/(admin)/admin/coupons";
import AdminDisputeScreen from "@/app/(admin)/admin/dispute/[id]";
import AdminFeatureFlagsScreen from "@/app/(admin)/admin/feature-flags";
import AdminPlatformSettingsScreen from "@/app/(admin)/admin/platform-settings";
import { ApiError, setImpersonationToken } from "@/lib/api";
import { EMPTY_COUPON_FORM, adminOpsErrorMessage, couponBody, couponFormIssues, type CouponForm } from "@/lib/admin-ops";
import i18n from "@/lib/i18n";
import type { AdminDispute, AdminFeatureFlag, AdminPlatformSettings } from "@/lib/types";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: "d1" }),
}));
jest.mock("expo-image", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Image: View };
});
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: {} }));
jest.mock("@/lib/auth", () => ({ useAuth: () => ({ state: { status: "signedIn", user: { id: "a1", role: "ADMIN" } } }) }));
jest.mock("@/lib/notify", () => ({ notify: jest.fn() }));
jest.mock("@/components/RevenueChart", () => ({ RevenueChart: () => null }));
jest.mock("@/components/Illustrations", () => ({ LuggageTag: () => null, MapSnippet: () => null }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

type Call = { path: string; method?: string; body?: unknown };
const mockCalls: Call[] = [];
let mockHandler: (c: Call) => Promise<unknown> = async () => ({});
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (path: string, opts: { method?: string; body?: unknown } = {}) => {
      const c = { path, method: opts.method, body: opts.body };
      mockCalls.push(c);
      return mockHandler(c);
    },
  };
});

const DISPUTE: AdminDispute = {
  id: "d1",
  bookingId: "b1",
  reason: "DAMAGE",
  description: "Valizin tekerlegi kirik",
  status: "OPEN",
  adminNote: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  booking: {
    id: "b1",
    totalPrice: 150,
    checkInTime: "2026-10-31T09:00:00.000Z",
    checkOutTime: "2026-10-31T18:00:00.000Z",
    status: "CHECKED_OUT",
    guestName: "Ada",
    guestEmail: "ada@x.com",
    shopName: "Kadikoy Bufe",
    seals: [],
  },
};

const SETTINGS: AdminPlatformSettings = {
  values: {
    maxStayDays: 30,
    maxBagsPerSlot: 50,
    insuranceFeeTry: 0,
    earlyRefundRatio: 1,
    cancelFixedFeeTry: 0,
    latePickupFeeTry: 0,
    latePickupGraceMin: 15,
    checkInGraceMin: 30,
    requireSealsOnCheckIn: true,
    defaultShopCapacity: 20,
    defaultPricePerDay: 100,
    bagMultiplierS: 1,
    bagMultiplierM: 1,
    bagMultiplierXl: 1,
    platformHolidayDates: [],
    minAppVersion: null,
    latestAppVersion: null,
  },
  riskyFields: ["insuranceFeeTry", "requireSealsOnCheckIn", "minAppVersion", "latestAppVersion"],
  updatedAt: "2026-11-01T10:00:00.000Z",
};

const FLAGS: AdminFeatureFlag[] = [
  { key: "mobile_security_menu", enabled: true, rolloutPct: 100, allowedUserIds: [], description: null, risky: false, updatedAt: "2026-11-01T10:00:00.000Z" },
  { key: "online_payments", enabled: false, rolloutPct: 0, allowedUserIds: [], description: null, risky: true, updatedAt: "2026-11-01T10:00:00.000Z" },
];

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const isDisabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) => el.props.accessibilityState?.disabled === true;
const writes = () => mockCalls.filter((c) => c.method && c.method !== "GET");

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => {
  qc.clear();
  setImpersonationToken(null);
});
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  mockCalls.length = 0;
  mockPush.mockClear();
  mockHandler = async ({ path, method }) => {
    if (path === "/admin/disputes/d1") return method === "PATCH" ? { ...DISPUTE, status: "RESOLVED" } : DISPUTE;
    if (path === "/admin/coupons") return method === "POST" ? { id: "c9", code: "YAZ25" } : { items: [] };
    if (path === "/admin/platform-settings") return SETTINGS;
    if (path === "/admin/feature-flags") return { items: FLAGS };
    if (path.startsWith("/admin/feature-flags/")) return { success: true };
    return {};
  };
});

describe("goruntuleme oturumunda yazma kapali", () => {
  it("uyusmazlikta Kaydet kapali ve uyari gorunur; yazma gitmez", async () => {
    setImpersonationToken("imp");
    await render(<AdminDisputeScreen />, { wrapper });
    await screen.findByText("Valizin tekerlegi kirik");
    expect(screen.getByText("Görüntüleme oturumundasın. Bu ekranda değişiklik yapılamaz.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Çözüldü"));
    expect(isDisabled(screen.getByRole("button", { name: "Kaydet" }))).toBe(true);
    expect(writes()).toEqual([]);
  });

  it("normal oturumda durum degisince Kaydet acilir ve PATCH gider", async () => {
    await render(<AdminDisputeScreen />, { wrapper });
    await screen.findByText("Valizin tekerlegi kirik");
    expect(isDisabled(screen.getByRole("button", { name: "Kaydet" }))).toBe(true);
    await fireEvent.press(screen.getByText("Çözüldü"));
    await fireEvent.changeText(screen.getByLabelText("Yönetici notu"), "  hasar onaylandi ");
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({ path: "/admin/disputes/d1", method: "PATCH", body: { status: "RESOLVED", adminNote: "hasar onaylandi" } });
  });

  it("yonetici notu 2000 karakterle sinirli (sunucu ile ayni)", async () => {
    await render(<AdminDisputeScreen />, { wrapper });
    await screen.findByText("Valizin tekerlegi kirik");
    expect(screen.getByLabelText("Yönetici notu").props.maxLength).toBe(2000);
  });

  it("kupon olusturma formu goruntulemede hic cizilmez", async () => {
    setImpersonationToken("imp");
    await render(<AdminCouponsScreen />, { wrapper });
    await screen.findByText("Henüz kupon yok.");
    expect(screen.queryByRole("button", { name: "Kuponu oluştur" })).toBeNull();
  });

  it("bayrak duzenleme dugmesi goruntulemede yok", async () => {
    setImpersonationToken("imp");
    await render(<AdminFeatureFlagsScreen />, { wrapper });
    await screen.findByText("online_payments");
    expect(screen.queryByRole("button", { name: "Düzenle" })).toBeNull();
  });
});

describe("platform ayari: yazarak onay", () => {
  /**
   * Sunucu taklidi: riskli degisiklikte dogru ifade yoksa 428 + eski -> yeni + ifade.
   * Surum degisiyorsa ifade yeni surumun kendisi (sunucu `platformSettingsConfirmPhrase`).
   */
  function serverLike(challenge: { phrase: string; changes: { field: string; from: unknown; to: unknown }[] } | null) {
    mockHandler = async ({ path, method, body }) => {
      if (path !== "/admin/platform-settings") return {};
      if (method !== "PUT") return SETTINGS;
      const b = body as { confirmation?: string };
      if (challenge && b.confirmation !== challenge.phrase) throw new ApiError(428, "confirmation_required", challenge);
      return SETTINGS;
    };
  }
  async function open() {
    await render(<AdminPlatformSettingsScreen />, { wrapper });
    await screen.findByLabelText("Sigorta ücreti (₺) · Riskli");
  }
  const puts = () => writes().filter((c) => c.method === "PUT");

  it("riskli degisiklik: 428 penceresi eski -> yeni gosterir; ifade birebir yazilmadan ikinci istek gitmez", async () => {
    serverLike({ phrase: "ONAYLA", changes: [{ field: "insuranceFeeTry", from: 0, to: 25 }] });
    await open();
    await fireEvent.changeText(screen.getByLabelText("Sigorta ücreti (₺) · Riskli"), "25");
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    const sheet = await screen.findByTestId("typed-confirm");
    expect(within(sheet).getByText("Sigorta ücreti (₺): 0 → 25")).toBeTruthy();
    expect(puts()).toHaveLength(1);
    expect((puts()[0].body as { confirmation?: string }).confirmation).toBeUndefined();
    const confirm = () => within(sheet).getByRole("button", { name: "Onayla ve kaydet" });
    expect(isDisabled(confirm())).toBe(true);
    await fireEvent.changeText(within(sheet).getByLabelText("Onay ifadesi"), "onayla");
    expect(isDisabled(confirm())).toBe(true);
    await fireEvent.changeText(within(sheet).getByLabelText("Onay ifadesi"), "ONAYLA");
    await fireEvent.press(confirm());
    await waitFor(() => expect(puts()).toHaveLength(2));
    const body = puts()[1].body as { values: Record<string, unknown>; confirmation: string; expectedUpdatedAt: string };
    expect(body.confirmation).toBe("ONAYLA");
    expect(body.values.insuranceFeeTry).toBe(25);
    expect(body.expectedUpdatedAt).toBe(SETTINGS.updatedAt);
  });

  it("minimum surum: ifade YENI surumun kendisi, ONAYLA yetmez", async () => {
    serverLike({ phrase: "0.3.3", changes: [{ field: "minAppVersion", from: null, to: "0.3.3" }] });
    await open();
    await fireEvent.changeText(screen.getByLabelText("En düşük uygulama sürümü · Riskli"), "0.3.3");
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    const sheet = await screen.findByTestId("typed-confirm");
    expect(within(sheet).getByText("En düşük uygulama sürümü: — → 0.3.3")).toBeTruthy();
    await fireEvent.changeText(within(sheet).getByLabelText("Onay ifadesi"), "ONAYLA");
    expect(isDisabled(within(sheet).getByRole("button", { name: "Onayla ve kaydet" }))).toBe(true);
    await fireEvent.changeText(within(sheet).getByLabelText("Onay ifadesi"), "0.3.3");
    await fireEvent.press(within(sheet).getByRole("button", { name: "Onayla ve kaydet" }));
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect((puts()[1].body as { confirmation: string }).confirmation).toBe("0.3.3");
  });

  it("risksiz alan onaysiz tek istekte kaydedilir", async () => {
    serverLike(null);
    await open();
    await fireEvent.changeText(screen.getByLabelText("En uzun emanet (gün)"), "10");
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(screen.queryByTestId("typed-confirm")).toBeNull();
  });

  it("onayla gonderilip yine 428 donerse hata pencerede gorunur", async () => {
    await open();
    mockHandler = async ({ method }) => {
      if (method === "PUT") throw new ApiError(428, "confirmation_required", { phrase: "ONAYLA", changes: [] });
      return SETTINGS;
    };
    await fireEvent.press(screen.getByText("Zorunlu değil"));
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    const sheet = await screen.findByTestId("typed-confirm");
    await fireEvent.changeText(within(sheet).getByLabelText("Onay ifadesi"), "ONAYLA");
    await fireEvent.press(within(sheet).getByRole("button", { name: "Onayla ve kaydet" }));
    expect(await within(sheet).findByText(/yazarak onay gerekiyor/)).toBeTruthy();
  });

  it.each([
    ["stale_settings", 409, /başka biri kaydetti/],
    ["invalid_version_gate", 400, /herkes güncelleme ekranında kalır/],
  ])("%s ekranda cevrilir", async (code, status, text) => {
    await open();
    mockHandler = async ({ method }) => {
      if (method === "PUT") throw new ApiError(status, code);
      return SETTINGS;
    };
    await fireEvent.changeText(screen.getByLabelText("En uzun emanet (gün)"), "10");
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.queryByTestId("typed-confirm")).toBeNull();
  });
});

describe("bayrak: riskli olan anahtarini yazmadan kaydedilmez", () => {
  it("riskli bayrak: anahtar yazilmadan PATCH yok, yazilinca confirmation=anahtar", async () => {
    await render(<AdminFeatureFlagsScreen />, { wrapper });
    const row = await screen.findByTestId("flag-online_payments");
    await fireEvent.press(within(row).getByRole("button", { name: "Düzenle" }));
    const editor = screen.getByTestId("flag-edit-online_payments");
    await fireEvent.press(within(editor).getByText("Açık"));
    await fireEvent.press(within(editor).getByRole("button", { name: "Kaydet" }));
    const sheet = await screen.findByTestId("typed-confirm");
    await fireEvent.changeText(within(sheet).getByLabelText("Onay ifadesi"), "ONLINE_PAYMENTS");
    expect(isDisabled(within(sheet).getByRole("button", { name: "Onayla ve kaydet" }))).toBe(true);
    expect(writes()).toEqual([]);
    await fireEvent.changeText(within(sheet).getByLabelText("Onay ifadesi"), "online_payments");
    await fireEvent.press(within(sheet).getByRole("button", { name: "Onayla ve kaydet" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].path).toBe("/admin/feature-flags/online_payments");
    expect(writes()[0].body).toMatchObject({ enabled: true, rolloutPct: 0, confirmation: "online_payments" });
  });

  it("risksiz bayrak dogrudan kaydedilir", async () => {
    await render(<AdminFeatureFlagsScreen />, { wrapper });
    const row = await screen.findByTestId("flag-mobile_security_menu");
    await fireEvent.press(within(row).getByRole("button", { name: "Düzenle" }));
    const editor = screen.getByTestId("flag-edit-mobile_security_menu");
    await fireEvent.press(within(editor).getByText("Kapalı"));
    await fireEvent.press(within(editor).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(screen.queryByTestId("typed-confirm")).toBeNull();
    expect(writes()[0].body).toMatchObject({ enabled: false, confirmation: undefined });
  });
});

describe("hata metinleri", () => {
  const generic = () => i18n.t("common.genericError");
  it.each([
    "forbidden",
    "not_allowed_while_impersonating",
    "not_found",
    "invalid_status",
    "invalid_data",
    "duplicate_code",
    "confirmation_required",
    "stale_settings",
    "invalid_version_gate",
    "note_too_long",
  ])("%s kendi metnine cevrilir (genel metne dusmez)", (code) => {
    const msg = adminOpsErrorMessage(new ApiError(400, code));
    expect(msg).toBe(i18n.t(`adminOps.errors.${code}`));
    expect(msg).not.toBe(generic());
  });

  it("bilinmeyen kod genel metne duser, ham kod basilmaz", () => {
    expect(adminOpsErrorMessage(new ApiError(500, "boom_internal"))).toBe(generic());
  });

  it("kupon: ayni kod sunucudan donunce ekranda cevrilmis metin", async () => {
    mockHandler = async ({ method }) => {
      if (method === "POST") throw new ApiError(409, "duplicate_code");
      return { items: [] };
    };
    await render(<AdminCouponsScreen />, { wrapper });
    await screen.findByText("Henüz kupon yok.");
    await fireEvent.changeText(screen.getByLabelText("Kod"), "YAZ25");
    await fireEvent.changeText(screen.getByLabelText("İndirim"), "25");
    await fireEvent.press(screen.getByRole("button", { name: "Kuponu oluştur" }));
    expect(await screen.findByText("Bu kodla bir kupon zaten var.")).toBeTruthy();
  });
});

describe("kupon formu sunucu semasiyla ayni sinirlar", () => {
  const f = (p: Partial<CouponForm>) => ({ ...EMPTY_COUPON_FORM, code: "YAZ25", discount: "25", ...p });
  const CASES: [string, Partial<CouponForm>, keyof CouponForm][] = [
    ["kisa kod", { code: "ab" }, "code"],
    ["boslukli kod", { code: "YAZ 25" }, "code"],
    ["yuzde 100 ustu", { discount: "150" }, "discount"],
    ["sifir indirim", { discount: "0" }, "discount"],
    ["negatif alt sinir", { minPrice: "-1" }, "minPrice"],
    ["kesirli kota", { maxUses: "1.5" }, "maxUses"],
    ["bozuk tarih", { expiresOn: "31.12.2026" }, "expiresOn"],
  ];
  it.each(CASES)("%s reddedilir", (_n, p, field) => {
    expect(couponFormIssues(f(p))).toEqual([field]);
  });

  it("tutar indiriminde 150 gecerli; bos istege bagli alanlar null gider", () => {
    const form = f({ discount: "150", isPercent: false });
    expect(couponFormIssues(form)).toEqual([]);
    expect(couponBody(form)).toEqual({ code: "YAZ25", discount: 150, isPercent: false, minPrice: null, maxUses: null, expiresAt: null });
  });

  it("hatali formda Olustur istek gondermez, alan hatasini gosterir", async () => {
    await render(<AdminCouponsScreen />, { wrapper });
    await screen.findByText("Henüz kupon yok.");
    await fireEvent.changeText(screen.getByLabelText("Kod"), "YAZ25");
    await fireEvent.changeText(screen.getByLabelText("İndirim"), "150");
    await fireEvent.press(screen.getByRole("button", { name: "Kuponu oluştur" }));
    expect(await screen.findByText(i18n.t("adminOps.coupons.invalid.discount"))).toBeTruthy();
    expect(writes()).toEqual([]);
  });
});

describe("Ozet: Yonetim araclari", () => {
  it("alti araca uygulama icinde gider; acik uyusmazlik satiri web yerine ekrani acar", async () => {
    mockHandler = async ({ path }) =>
      path === "/admin/overview"
        ? {
            series: [],
            today: { arrivals: 0, pickups: 0, bagsInStorage: 0, newBookings: 0, revenue: 0 },
            attention: { pendingApplications: 0, unreadMessages: 0, openDisputes: 2, overdueBookings: 0 },
            totals: { revenue: 0, bookings: 0, activeShops: 0 },
            recent: [],
          }
        : {};
    await render(<AdminDashboardScreen />, { wrapper });
    await screen.findByText("Yönetim araçları");
    for (const [label, href] of [
      ["Uyuşmazlıklar", "/admin/disputes"],
      ["Kuponlar", "/admin/coupons"],
      ["Aracılar", "/admin/affiliates"],
      ["Ödemeler", "/admin/payments"],
      ["Platform ayarları", "/admin/platform-settings"],
      ["Özellik bayrakları", "/admin/feature-flags"],
    ] as const) {
      mockPush.mockClear();
      await fireEvent.press(screen.getByText(label));
      expect(mockPush).toHaveBeenCalledWith(href);
    }
    expect(screen.getByText("Duyuru gönder")).toBeTruthy();
    mockPush.mockClear();
    await fireEvent.press(screen.getByLabelText(`${i18n.t("admin.openDisputes")}: 2`));
    expect(mockPush).toHaveBeenCalledWith("/admin/disputes");
  });
});
