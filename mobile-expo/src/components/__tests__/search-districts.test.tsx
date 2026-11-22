/**
 * Arama sihirbazinda sehirden sonraki ilce adimi. "Merkez" bugunku sehir secimiyle
 * birebir ayni yeri kurar; ilce secimi "<Ilce>, <Sehir>" etiketini ve ilce merkezini.
 * Uc yoksa (bugunku uretim sunucusu HTML 404 doner) adim hic acilmaz.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SearchWizard from "@/app/(guest)/search";
import { ApiError } from "@/lib/api";
import i18n from "@/lib/i18n";
import { SearchProvider, useSearch } from "@/lib/search";
import type { Place } from "@/lib/search";
import type { CityCoverage } from "@/lib/types";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/lib/location", () => ({ getDevicePosition: jest.fn() }));
jest.mock("@/components/PlaceSearch", () => ({ PlaceSearch: () => null }));
jest.mock("@/components/RemoteImage", () => ({ RemoteImage: () => null }));
jest.mock("@/components/StayWindowPicker", () => ({ StayWindowPicker: () => null, isStayWindowValid: () => true }));

const ISTANBUL: CityCoverage = {
  name: "İstanbul",
  slug: "istanbul",
  shopCount: 5,
  latitude: 41.03,
  longitude: 28.98,
  radiusM: 40_000,
  coverImage: null,
};
jest.mock("@/lib/queries", () => ({ useCities: () => ({ data: [ISTANBUL] }) }));

let mockHandler: (path: string) => Promise<unknown>;
const mockPaths: string[] = [];
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (path: string) => {
      mockPaths.push(path);
      return mockHandler(path);
    },
  };
});

const DISTRICTS = [
  { name: "Beşiktaş", slug: "besiktas", shopCount: 1, latitude: 41.04, longitude: 29.0 },
  { name: "Kadıköy", slug: "kadikoy", shopCount: 3, latitude: 40.99, longitude: 29.03 },
];

// Secilen yer ekrana yazilir: render sirasinda dis degiskene yazmak lint kuralina takilir.
function Probe() {
  return <Text testID="placed">{JSON.stringify(useSearch().place)}</Text>;
}
const placed = (): Place | null => JSON.parse(String(screen.getByTestId("placed").props.children)) as Place | null;

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <SearchProvider>
        {children}
        <Probe />
      </SearchProvider>
    </QueryClientProvider>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mockPaths.length = 0;
  mockHandler = async () => ({ districts: DISTRICTS });
});

const TODAY_CITY_PLACE = { label: "İstanbul", latitude: 41.03, longitude: 28.98, radiusM: 40_000 };

async function openCity() {
  await render(<SearchWizard />, { wrapper });
  await fireEvent.press(screen.getByText("İstanbul"));
}

describe("ilce adimi", () => {
  it("sehirden sonra Merkez ilk satir, ilceler sunucu sirasiyla altinda", async () => {
    await openCity();
    await screen.findByText("İstanbul içinde nerede?");
    expect(mockPaths).toContain("/cities/istanbul/districts");
    const labels = screen.getAllByText(/^(Merkez|Beşiktaş|Kadıköy)$/).map((n) => n.props.children);
    expect(labels).toEqual(["Merkez", "Beşiktaş", "Kadıköy"]);
    expect(placed()).toBeNull();
  });

  it("Merkez bugunku sehir secimiyle ayni yeri kurar ve zaman adimina gecer", async () => {
    await openCity();
    await fireEvent.press(await screen.findByText("Merkez"));
    expect(placed()).toEqual(TODAY_CITY_PLACE);
    expect(screen.getByText("Ne zaman lazım?")).toBeTruthy();
  });

  it("ilce secimi etiketi '<Ilce>, <Sehir>' ve merkezi ilce ortalamasi yapar", async () => {
    await openCity();
    await fireEvent.press(await screen.findByText("Kadıköy"));
    expect(placed()).toEqual({ label: "Kadıköy, İstanbul", latitude: 40.99, longitude: 29.03 });
    expect(screen.getByText("Ne zaman lazım?")).toBeTruthy();
  });

  it("geri dugmesi ilce adimindan sehir listesine doner", async () => {
    await openCity();
    await screen.findByText("Merkez");
    await fireEvent.press(screen.getByRole("button", { name: "Geri" }));
    expect(screen.queryByText("Merkez")).toBeNull();
    expect(screen.getByText("Popüler şehirler")).toBeTruthy();
  });

  it("uc yoksa (eski sunucu, http_404) adim atlanir: sehir bugunku gibi secilir", async () => {
    mockHandler = async () => {
      throw new ApiError(404, "http_404");
    };
    await openCity();
    await waitFor(() => expect(placed()).toEqual(TODAY_CITY_PLACE));
    expect(screen.queryByText("Merkez")).toBeNull();
    expect(screen.getByText("Ne zaman lazım?")).toBeTruthy();
  });

  it("ag hatasinda da adim atlanir", async () => {
    mockHandler = async () => {
      throw new ApiError(0, "network");
    };
    await openCity();
    await waitFor(() => expect(placed()).toEqual(TODAY_CITY_PLACE));
    expect(screen.queryByText("Merkez")).toBeNull();
  });

  it("bos liste ya da yalnizca 'Merkez' adli ilce: adim atlanir", async () => {
    mockHandler = async () => ({ districts: [{ name: "Merkez", slug: "merkez", shopCount: 2, latitude: 41, longitude: 29 }] });
    await openCity();
    await waitFor(() => expect(placed()).toEqual(TODAY_CITY_PLACE));
    expect(screen.queryByText("İstanbul içinde nerede?")).toBeNull();
  });
});
