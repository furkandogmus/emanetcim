/**
 * Yonetici dukkan icerigi: yorum moderasyonu gerekcesiz gitmez, goruntuleme
 * oturumunda yazma dugmeleri yok, sunucu hata kodlari cevrilir; fotograf izgarasi
 * yonetici yollarina gider ve salt okunurken ekleme karesi cizilmez.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import AdminReviewsScreen from "@/app/(admin)/admin/reviews";
import { ShopPhotoGrid } from "@/components/ShopPhotos";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import i18n from "@/lib/i18n";
import { canEditAdminContent, canSubmitModeration } from "@/lib/review-moderation";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/components/StaleQueryBanner", () => ({ StaleQueryBanner: () => null }));
jest.mock("@/components/RemoteImage", () => ({ RemoteImage: () => null }));

let mockImpersonating: unknown = null;
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: { status: "signedIn", user: { id: "a1", role: "ADMIN" } }, impersonating: mockImpersonating }),
}));

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

const REVIEW = {
  id: "r1",
  rating: 1,
  comment: "Berbat",
  createdAt: "2026-11-20T10:00:00Z",
  authorLabel: "Ada",
  guestName: "Ada Yilmaz",
  shop: { id: "s1", name: "Kadikoy Emanet" },
  hidden: false,
  hiddenAt: null,
  hiddenReason: null,
  autoHidden: false,
  openReportCount: 2,
  reports: [{ reason: "OFFENSIVE", note: "hakaret" }],
};

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const moderationCalls = () => mockCalls.filter((c) => c.path.startsWith("/admin/reviews/r1/"));
const isDisabled = (el: { props: { accessibilityState?: { disabled?: boolean } } }) =>
  el.props.accessibilityState?.disabled === true;

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  mockCalls.length = 0;
  mockImpersonating = null;
  mockHandler = async (c) => (c.path.startsWith("/admin/reviews?") ? { items: [REVIEW], total: 1, nextCursor: null } : { ok: true });
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

describe("yorum moderasyonu ekrani", () => {
  it("gizleme gerekce yazilmadan gonderilmez; yazilinca gerekceyle gider", async () => {
    await render(<AdminReviewsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole("button", { name: "Gizle" }));
    const confirm = screen.getByRole("button", { name: "Yorumu gizle" });
    expect(isDisabled(confirm)).toBe(true);

    await fireEvent.changeText(screen.getByLabelText("Neden"), "ab");
    expect(isDisabled(screen.getByRole("button", { name: "Yorumu gizle" }))).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Yorumu gizle" }));
    expect(moderationCalls()).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText("Neden"), "Hakaret");
    await fireEvent.press(screen.getByRole("button", { name: "Yorumu gizle" }));
    await waitFor(() =>
      expect(moderationCalls()).toEqual([{ path: "/admin/reviews/r1/hide", method: "POST", body: { reason: "Hakaret" } }]),
    );
  });

  it("silme de gerekce ister ve sunucu kodunu panelde cevirir", async () => {
    mockHandler = async (c) => {
      if (c.path.startsWith("/admin/reviews?")) return { items: [REVIEW], total: 1, nextCursor: null };
      throw new ApiError(404, "not_found");
    };
    await render(<AdminReviewsScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole("button", { name: "Sil" }));
    expect(isDisabled(screen.getByRole("button", { name: "Yorumu sil" }))).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Neden"), "Spam yorum");
    await fireEvent.press(screen.getByRole("button", { name: "Yorumu sil" }));
    await waitFor(() => expect(screen.getByText(i18n.t("adminShop.errors.not_found"))).toBeTruthy());
    expect(moderationCalls()[0]).toMatchObject({ path: "/admin/reviews/r1/delete", body: { reason: "Spam yorum" } });
  });

  it("goruntuleme oturumunda gizle/sil dugmeleri yok, uyari var", async () => {
    mockImpersonating = { user: { id: "p1" } };
    await render(<AdminReviewsScreen />, { wrapper });
    await screen.findByText("Berbat");
    expect(screen.queryByRole("button", { name: "Gizle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sil" })).toBeNull();
    expect(screen.getByText(i18n.t("adminShop.readOnly"))).toBeTruthy();
  });

  it("kuyruk bildirilenlerle acilir; bildirim sayisi ve nedeni satirda gorunur (App Review 1.2)", async () => {
    await render(<AdminReviewsScreen />, { wrapper });
    await screen.findByText("Berbat");
    expect(mockCalls.some((c) => c.path === "/admin/reviews?filter=reported")).toBe(true);
    expect(screen.getByText("2 bildirim")).toBeTruthy();
    expect(screen.getByText("Küfür veya hakaret: hakaret")).toBeTruthy();
  });

  it("filtre degisince sunucuya filtreyle sorulur", async () => {
    await render(<AdminReviewsScreen />, { wrapper });
    await screen.findByText("Berbat");
    await fireEvent.press(screen.getByText("Düşük puan"));
    await waitFor(() => expect(mockCalls.some((c) => c.path === "/admin/reviews?filter=low")).toBe(true));
  });
});

describe("fotograf izgarasi", () => {
  const props = {
    image: "https://cdn/c.jpg",
    gallery: [{ id: "g1", url: "https://cdn/g1.jpg" }],
    basePath: "/admin/shops/s1",
    onChanged: () => Promise.resolve(),
    errorNamespace: "adminShop",
  };

  it("salt okunurken ekleme karesi ve yazma dugmeleri cizilmez", async () => {
    await render(<ShopPhotoGrid {...props} readOnly />, { wrapper });
    expect(screen.queryByRole("button", { name: i18n.t("partner.addPhotos") })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("partner.photo") }));
    expect(screen.queryByRole("button", { name: i18n.t("partner.makeCover") })).toBeNull();
  });

  it("kapak yapma yonetici yoluna gider", async () => {
    await render(<ShopPhotoGrid {...props} />, { wrapper });
    expect(screen.getByRole("button", { name: i18n.t("partner.addPhotos") })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("partner.photo") }));
    await fireEvent.press(screen.getByRole("button", { name: i18n.t("partner.makeCover") }));
    await waitFor(() => expect(mockCalls).toContainEqual({ path: "/admin/shops/s1/images/g1/cover", method: "POST", body: undefined }));
  });
});

describe("kurallar ve hata kodlari", () => {
  it("gerekce: gizle/sil en az 3 karakter, geri al serbest", () => {
    expect(canSubmitModeration("hide", "  ab ")).toBe(false);
    expect(canSubmitModeration("delete", "Spam")).toBe(true);
    expect(canSubmitModeration("unhide", "")).toBe(true);
    expect(canEditAdminContent(null)).toBe(true);
    expect(canEditAdminContent({ user: { id: "p1" } })).toBe(false);
  });

  it("sunucunun dondurdugu her kod her dilde cevrilir, genel metne dusmez", async () => {
    const codes = [
      "not_found", "not_owner", "forbidden", "not_allowed_while_impersonating", "limit", "empty", "too_large",
      "unsupported_type", "dimensions_too_large", "storage_unavailable", "schedule_conflict", "invalid_input",
      "schedule_save_failed", "reason_required", "already_hidden", "not_hidden", "invalid_action", "invalid_data",
    ];
    for (const lng of ["tr", "en", "de", "fr", "ja", "ru"]) {
      await i18n.changeLanguage(lng);
      const generic = i18n.t("common.genericError");
      for (const code of codes) expect([lng, code, errorMessage(new ApiError(400, code), "adminShop")]).not.toEqual([lng, code, generic]);
    }
    await i18n.changeLanguage("tr");
  });
});
