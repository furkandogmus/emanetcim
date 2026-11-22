/**
 * Arama sihirbazinda sehirden sonraki ilce adimi. "Merkez" bugunku sehir secimiyle
 * birebir ayni yeri kurar; ilce secimi "<Ilce>, <Sehir>" etiketini ve ilce merkezini.
 * Uc yoksa (bugunku uretim sunucusu HTML 404 doner) adim hic acilmaz.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactNode } from "react";
import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import SearchWizard from "@/app/(guest)/search";
import { ApiError } from "@/lib/api";
import i18n from "@/lib/i18n";
import { DISTRICTS_TIMEOUT_MS, loadCityDistricts } from "@/lib/districts";
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
// Adres arama: tek dokunusla sabit bir adres secen yer tutucu.
jest.mock("@/components/PlaceSearch", () => {
  const RN = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    PlaceSearch: ({ onChoose }: { onChoose: (p: { label: string; latitude: number; longitude: number }) => void }) => (
      <RN.Pressable accessibilityRole="button" onPress={() => onChoose({ label: "Taksim Meydanı", latitude: 41.037, longitude: 28.985 })}>
        <RN.Text>Adres seç</RN.Text>
      </RN.Pressable>
    ),
  };
});
jest.mock("@/components/RemoteImage", () => ({ RemoteImage: () => null }));
jest.mock("@/components/StayWindowPicker", () => ({ StayWindowPicker: () => null, isStayWindowValid: () => true }));

const MOCK_ISTANBUL: CityCoverage = {
  name: "İstanbul",
  slug: "istanbul",
  shopCount: 5,
  latitude: 41.03,
  longitude: 28.98,
  radiusM: 40_000,
  coverImage: null,
};
const MOCK_ANKARA: CityCoverage = { ...MOCK_ISTANBUL, name: "Ankara", slug: "ankara", latitude: 39.93, longitude: 32.85, radiusM: 20_000 };
jest.mock("@/lib/queries", () => ({ useCities: () => ({ data: [MOCK_ISTANBUL, MOCK_ANKARA] }) }));

let mockHandler: (path: string, opts: { signal?: AbortSignal }) => Promise<unknown>;
const mockPaths: string[] = [];
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (path: string, opts: { signal?: AbortSignal } = {}) => {
      mockPaths.push(path);
      return mockHandler(path, opts);
    },
  };
});

const DISTRICTS = [
  { name: "Beşiktaş", slug: "besiktas", shopCount: 1, latitude: 41.04, longitude: 29.0, radiusM: 15_000 },
  { name: "Kadıköy", slug: "kadikoy", shopCount: 3, latitude: 40.99, longitude: 29.03, radiusM: 18_000 },
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
    expect(placed()).toEqual({ label: "Kadıköy, İstanbul", latitude: 40.99, longitude: 29.03, radiusM: 18_000 });
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
    mockHandler = async () => ({ districts: [{ name: "Merkez", slug: "merkez", shopCount: 2, latitude: 41, longitude: 29, radiusM: 15_000 }] });
    await openCity();
    await waitFor(() => expect(placed()).toEqual(TODAY_CITY_PLACE));
    expect(screen.queryByText("İstanbul içinde nerede?")).toBeNull();
  });

  it("'Merkez' adli ilce digerlerinin arasinda da listeden duser", async () => {
    mockHandler = async () => ({
      districts: [DISTRICTS[0], { name: "Merkez", slug: "merkez", shopCount: 2, latitude: 41, longitude: 29, radiusM: 15_000 }, DISTRICTS[1]],
    });
    await openCity();
    await screen.findByText("İstanbul içinde nerede?");
    const labels = screen.getAllByText(/^(Merkez|Beşiktaş|Kadıköy)$/).map((n) => n.props.children);
    expect(labels).toEqual(["Merkez", "Beşiktaş", "Kadıköy"]);
  });
});

describe("yuklenirken baska secim", () => {
  type Deferred = { resolve: (v: unknown) => void };
  let pending: Record<string, Deferred>;
  beforeEach(() => {
    pending = {};
    mockHandler = (path) => new Promise((resolve) => (pending[path] = { resolve }));
  });

  it("yuklenirken secilen adres korunur; gec gelen bos yanit onu sehirle ezmez", async () => {
    await openCity();
    await fireEvent.press(screen.getByText("Adres seç"));
    const taksim = { label: "Taksim Meydanı", latitude: 41.037, longitude: 28.985 };
    expect(placed()).toEqual(taksim);
    await act(async () => pending["/cities/istanbul/districts"].resolve({ districts: [] }));
    expect(placed()).toEqual(taksim);
    expect(screen.getByText("Ne zaman lazım?")).toBeTruthy();
  });

  it("yuklenirken secilen adres korunur; gec gelen dolu yanit ilce adimini acmaz", async () => {
    await openCity();
    await fireEvent.press(screen.getByText("Adres seç"));
    await act(async () => pending["/cities/istanbul/districts"].resolve({ districts: DISTRICTS }));
    expect(screen.queryByText("İstanbul içinde nerede?")).toBeNull();
    expect(screen.getByText("Ne zaman lazım?")).toBeTruthy();
  });

  it("art arda iki sehir: yalnizca sonuncusu gecer, eski yanit yok sayilir", async () => {
    await openCity();
    await fireEvent.press(screen.getByText("Ankara"));
    // Eski (Istanbul) yanit once gelir: yok sayilir, Ankara beklenir.
    await act(async () => pending["/cities/istanbul/districts"].resolve({ districts: DISTRICTS }));
    expect(screen.queryByText("İstanbul içinde nerede?")).toBeNull();
    expect(placed()).toBeNull();
    await act(async () =>
      pending["/cities/ankara/districts"].resolve({
        districts: [{ name: "Çankaya", slug: "cankaya", shopCount: 2, latitude: 39.9, longitude: 32.86, radiusM: 15_000 }],
      }),
    );
    expect(screen.getByText("Ankara içinde nerede?")).toBeTruthy();
  });
});

describe("yavas ag", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("5 sn icinde yanit yoksa istek kesilir, tekrar denenmez, adim atlanir (bos liste)", async () => {
    jest.useFakeTimers();
    mockHandler = (_path, opts) =>
      new Promise((_resolve, reject) =>
        opts.signal?.addEventListener("abort", () => reject(new ApiError(0, "network"))),
      );
    // Uygulamanin istemcisi (_layout.tsx) ag hatasini bir kez tekrar dener; bu sorgu denememeli.
    const client = new QueryClient({ defaultOptions: { queries: { retry: (count) => count < 1, retryDelay: 0 } } });
    const result = loadCityDistricts(client, MOCK_ISTANBUL);
    await jest.advanceTimersByTimeAsync(DISTRICTS_TIMEOUT_MS - 1);
    let settled = false;
    void result.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([]);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(mockPaths).toEqual(["/cities/istanbul/districts"]);
    client.clear();
  });
});
