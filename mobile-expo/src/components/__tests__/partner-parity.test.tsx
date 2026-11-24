/**
 * D6 esnaf esligi: ayarlardaki SMS numarasi `/partner/phone`a gider (kayitli
 * numarayi degistirmek onayla), kazanc grafikleri sunucunun `insights`ini cizer.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert, type AlertButton } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import PartnerSettingsScreen from "@/app/(partner)/partner/settings";
import { PartnerInsightCharts } from "@/components/PartnerInsightCharts";
import i18n from "@/lib/i18n";
import type { PartnerEarningsInsights } from "@/lib/types";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/components/StaleQueryBanner", () => ({ StaleQueryBanner: () => null }));
const mockImpersonating: { value: unknown } = { value: null };
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: { status: "signedIn", user: { id: "p1", role: "PARTNER" } }, impersonating: mockImpersonating.value }),
}));
jest.mock("@/lib/partner-shop", () => {
  const actual = jest.requireActual<typeof import("@/lib/partner-shop")>("@/lib/partner-shop");
  return { ...actual, usePartnerShopSelection: () => ["s9", () => undefined] };
});

type Call = { path: string; method?: string; body?: unknown };
const mockCalls: Call[] = [];
const mockShop = {
  id: "s9",
  name: "Dukkan",
  image: null,
  capacity: 10,
  pricePerDay: 250,
  address: null,
  city: null,
  district: null,
  latitude: null,
  longitude: null,
  phone: "5321234567",
};
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
      mockCalls.push({ path, method: opts.method, body: opts.body });
      if (!opts.method && path.startsWith("/partner/shop")) return mockShop;
      if (path === "/partner/phone") return { success: true, phone: (opts.body as { phone: string | null }).phone };
      return { ok: true };
    },
  };
});

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const writes = () => mockCalls.filter((c) => c.method);

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => {
  qc.clear();
  jest.restoreAllMocks();
});
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  mockCalls.length = 0;
  mockImpersonating.value = null;
});

describe("esnaf ayarlari: SMS numarasi ve pin", () => {
  it("kayitli numarayi degistirmek onay ister, onaydan sonra normal bicimde /partner/phone'a gider", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _b, buttons?: AlertButton[]) => {
      buttons?.find((b) => b.style !== "cancel")?.onPress?.();
    });
    await render(<PartnerSettingsScreen />, { wrapper });
    const field = await screen.findByLabelText(i18n.t("partnerParity.smsPhoneLabel"));
    expect(screen.getByText(i18n.t("partnerParity.locationMissing"))).toBeTruthy();

    await fireEvent.changeText(field, "0533 111 22 33");
    await fireEvent.press(screen.getByText(i18n.t("partnerParity.smsPhoneSave")));
    await waitFor(() => expect(writes()).toEqual([{ path: "/partner/phone", method: "PUT", body: { phone: "5331112233" } }]));
    expect(alert.mock.calls[0][0]).toBe(i18n.t("partnerParity.smsPhoneChangeTitle"));
  });

  it("gecersiz numara istek atmaz", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    await render(<PartnerSettingsScreen />, { wrapper });
    await fireEvent.changeText(await screen.findByLabelText(i18n.t("partnerParity.smsPhoneLabel")), "123");
    await fireEvent.press(screen.getByText(i18n.t("partnerParity.smsPhoneSave")));
    expect(await screen.findByText(i18n.t("partnerParity.errors.invalid_tr_phone"))).toBeTruthy();
    expect(writes()).toHaveLength(0);
  });

  it("goruntuleme oturumunda kaydet dugmesi yok", async () => {
    mockImpersonating.value = { userId: "p1" };
    await render(<PartnerSettingsScreen />, { wrapper });
    expect(await screen.findByText(i18n.t("partnerParity.smsPhoneLocked"))).toBeTruthy();
    expect(screen.queryByText(i18n.t("partnerParity.smsPhoneSave"))).toBeNull();
  });
});

describe("kazanc grafikleri", () => {
  const insights: PartnerEarningsInsights = {
    months: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month, i) => ({
      month,
      net: i * 100,
      count: i,
    })),
    peakHours: Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, count: h === 14 ? 6 : 1 })),
    avgStayHours: 5,
    conversionPct: 80,
    avgRating: 4.5,
  };

  it("varsayilan okuma bu ay ve en yogun saat; ozet oranlar yazilir", async () => {
    await render(<PartnerInsightCharts insights={insights} />);
    expect(screen.getByText(/₺500/)).toBeTruthy();
    expect(screen.getByText(i18n.t("partnerParity.peakReadoutBusiest", { hour: "14:00", dropoffs: i18n.t("partnerParity.dropoffs", { count: 6 }) }))).toBeTruthy();
    expect(screen.getByText("%80")).toBeTruthy();
    expect(screen.getByText("4,5")).toBeTruthy();
  });

  it("veri yoksa yogun saat yerine bos metin", async () => {
    await render(
      <PartnerInsightCharts insights={{ ...insights, peakHours: insights.peakHours.map((h) => ({ ...h, count: 0 })), avgRating: null }} />,
    );
    expect(screen.getByText(i18n.t("partnerParity.peakEmpty"))).toBeTruthy();
  });
});
