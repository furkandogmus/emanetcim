/**
 * Pini olmayan dukkan haritaya dokunmadan kaydedemez: varsayilan merkez gercek
 * konum gibi yazilir ve onaydaki `missing_coordinates` kapisi delinirdi.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import PartnerLocationScreen from "@/app/(partner)/partner/location";
import i18n from "@/lib/i18n";

jest.setTimeout(20_000);

type MapProps = {
  onPress?: (e: { nativeEvent: { lngLat: [number, number] } }) => void;
  onRegionDidChange?: (e: { nativeEvent: { userInteraction: boolean; center: [number, number] } }) => void;
};
const mockMap: { props: MapProps | null } = { props: null };
jest.mock("@maplibre/maplibre-react-native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Map: (props: MapProps & { children?: ReactNode }) => {
      mockMap.props = props;
      return React.createElement(React.Fragment, null, props.children);
    },
    Camera: React.forwardRef(function MockCamera() {
      return null;
    }),
  };
});
jest.mock("expo-location", () => ({}));
jest.mock("@/lib/map-style", () => ({ MAP_ATTRIBUTION: "OSM", useMapStyle: () => "style" }));
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() } }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/lib/auth", () => ({ useAuth: () => ({ state: { status: "signedIn" }, impersonating: null }) }));
jest.mock("@/components/StaleQueryBanner", () => ({ StaleQueryBanner: () => null }));
jest.mock("@/lib/partner-shop", () => {
  const actual = jest.requireActual<typeof import("@/lib/partner-shop")>("@/lib/partner-shop");
  return { ...actual, usePartnerShopSelection: () => ["s9", () => undefined] };
});

const mockShop: { value: Record<string, unknown> } = { value: {} };
const mockCalls: { path: string; method?: string; body?: unknown }[] = [];
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
      mockCalls.push({ path, method: opts.method, body: opts.body });
      return opts.method ? { ok: true } : mockShop.value;
    },
  };
});

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const saveButton = () => screen.getByRole("button", { name: i18n.t("partnerParity.locationSave") });
const writes = () => mockCalls.filter((c) => c.method);

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => {
  qc.clear();
  jest.restoreAllMocks();
});
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  mockCalls.length = 0;
  mockShop.value = { id: "s9", name: "Dukkan", image: null, capacity: 10, pricePerDay: 250, address: null, city: null, district: null, latitude: null, longitude: null };
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

describe("konum pini ekrani", () => {
  it("pinsiz dukkanda haritaya dokunmadan kaydet kapali; dokununca dokunulan nokta gider", async () => {
    await render(<PartnerLocationScreen />, { wrapper });
    await screen.findByText(i18n.t("partnerParity.locationPickFirst"));
    expect(saveButton().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(saveButton());
    expect(writes()).toHaveLength(0);

    await act(async () => mockMap.props?.onPress?.({ nativeEvent: { lngLat: [29.0251234567, 41.0451234567] } }));
    expect(saveButton().props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(saveButton());
    await waitFor(() =>
      expect(writes()).toEqual([{ path: "/partner/shop?shop=s9", method: "PUT", body: { latitude: 41.045123, longitude: 29.025123 } }]),
    );
  });

  it("haritayi surukleme de dokunma sayilir; programli kayma sayilmaz", async () => {
    await render(<PartnerLocationScreen />, { wrapper });
    await screen.findByText(i18n.t("partnerParity.locationPickFirst"));
    await act(async () => mockMap.props?.onRegionDidChange?.({ nativeEvent: { userInteraction: false, center: [29, 41] } }));
    expect(saveButton().props.accessibilityState.disabled).toBe(true);
    await act(async () => mockMap.props?.onRegionDidChange?.({ nativeEvent: { userInteraction: true, center: [29, 41] } }));
    expect(saveButton().props.accessibilityState.disabled).toBe(false);
  });

  it("pini olan dukkan dogrudan kaydedebilir", async () => {
    mockShop.value = { ...mockShop.value, latitude: 41.01, longitude: 28.97 };
    await render(<PartnerLocationScreen />, { wrapper });
    await screen.findByText(i18n.t("partnerParity.locationHint"));
    expect(saveButton().props.accessibilityState.disabled).toBe(false);
  });
});
