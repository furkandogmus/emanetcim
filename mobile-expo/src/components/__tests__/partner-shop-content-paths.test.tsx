/**
 * Esnaf yollari degismedi: fotograf izgarasi ve saat formu yonetici icin paylasilir
 * hale geldi (`basePath`), esnaf ekranlari ise eskisi gibi `/partner/shop...` +
 * secili dukkan (`?shop=`) adreslerine gitmeli.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert, type AlertButton } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import PartnerScheduleScreen from "@/app/(partner)/partner/schedule";
import { ShopPhotos } from "@/components/ShopPhotos";
import i18n from "@/lib/i18n";
import type { PartnerShop } from "@/lib/types";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/components/StaleQueryBanner", () => ({ StaleQueryBanner: () => null }));
jest.mock("@/components/RemoteImage", () => ({ RemoteImage: () => null }));
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: { status: "signedIn", user: { id: "p1", role: "PARTNER" } }, impersonating: null }),
}));
jest.mock("@/lib/partner-shop", () => {
  const actual = jest.requireActual<typeof import("@/lib/partner-shop")>("@/lib/partner-shop");
  return { ...actual, usePartnerShopSelection: () => ["s9", () => undefined] };
});

type Call = { path: string; method?: string; body?: unknown };
const mockCalls: Call[] = [];
const mockSchedule = {
  open247: false,
  days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, isClosed: false, openingTime: "09:00", closingTime: "20:00" })),
  closures: [{ id: "c1", startDate: "2099-01-02", endDate: "2099-01-02", reason: null }],
};
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
      mockCalls.push({ path, method: opts.method, body: opts.body });
      if (!opts.method && path.startsWith("/partner/shop/schedule")) return mockSchedule;
      if (!opts.method && path.startsWith("/partner/shop")) return { id: "s9", name: "Dukkan" };
      return { ok: true };
    },
  };
});

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const writes = () => mockCalls.filter((c) => c.method);
/** Onay penceresinde yikici dugmeye basar. */
const confirmAlerts = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_t, _b, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  mockCalls.length = 0;
});

describe("esnaf saat ekrani", () => {
  it("okuma, kaydetme ve izin kaldirma /partner/shop/schedule + secili dukkana gider", async () => {
    confirmAlerts();
    await render(<PartnerScheduleScreen />, { wrapper });
    await screen.findByText(i18n.t("schedule.save"));
    expect(mockCalls[0].path).toBe("/partner/shop/schedule?shop=s9");

    await fireEvent.press(screen.getByText(i18n.t("schedule.save")));
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("schedule.remove") }));
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[0]).toEqual({
      path: "/partner/shop/schedule?shop=s9",
      method: "PUT",
      body: { open247: false, days: mockSchedule.days },
    });
    expect(writes()[1]).toEqual({ path: "/partner/shop/schedule?closureId=c1&shop=s9", method: "DELETE", body: undefined });
  });
});

describe("esnaf fotograf izgarasi", () => {
  const shop = { id: "s9", name: "Dukkan", image: "https://cdn/c.jpg", gallery: [{ id: "g1", url: "https://cdn/g1.jpg" }] } as PartnerShop;

  it("kapak yapma ve silme /partner/shop/images + secili dukkana gider", async () => {
    confirmAlerts();
    await render(<ShopPhotos shop={shop} shopId="s9" />, { wrapper });
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("partner.photo") }));
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("partner.makeCover") }));
    await waitFor(() =>
      expect(writes()).toContainEqual({ path: "/partner/shop/images/g1/cover?shop=s9", method: "POST", body: undefined }),
    );

    await fireEvent.press(screen.getByRole("button", { name: i18n.t("partner.photo") }));
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("partner.deletePhoto") }));
    await waitFor(() =>
      expect(writes()).toContainEqual({ path: "/partner/shop/images/g1?shop=s9", method: "DELETE", body: undefined }),
    );
  });
});
