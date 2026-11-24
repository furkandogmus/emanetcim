/**
 * Web -> mobil yonetici paritesi (D1): kullanici kartinda kalici silme ve IP engeli
 * gerekce ister ve dogru uca gider, esnafa cevirme yalniz misafirde; liste ve gelen
 * kutusu suzgecleri sorgu metnine dogru girer; basvuru aramasi; her sunucu hata
 * kodunun ceviri metni var.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import AdminUserScreen from "@/app/(admin)/admin/user/[id]";
import {
  canBlockIp,
  canConvertToPartner,
  canHardDelete,
  isConvertFormValid,
} from "@/lib/admin-user-actions";
import { searchApplications } from "@/lib/admin-search";
import { adminMessageParams, adminUserListParams, DEFAULT_MESSAGE_FILTERS, NO_USER_FILTERS } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import i18n from "@/lib/i18n";
import type { AdminApplication, AdminUserDetail } from "@/lib/types";

jest.setTimeout(20_000);

let mockParams: Record<string, string> = { id: "g1" };
let mockMyId = "admin-1";
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), setParams: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: {} }));
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: { status: "signedIn", user: { id: mockMyId, role: "ADMIN" } } }),
}));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

type Call = { path: string; body?: unknown };
const mockCalls: Call[] = [];
let mockHandler: (path: string, body: unknown) => Promise<unknown> = async () => ({});
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (path: string, opts: { body?: unknown } = {}) => {
      mockCalls.push({ path, body: opts.body });
      return mockHandler(path, opts.body);
    },
  };
});

const GUEST: AdminUserDetail = {
  id: "g1",
  name: "Ada",
  email: "ada@example.com",
  phone: "5551112233",
  whatsapp: "905551112233",
  role: "GUEST",
  isBanned: false,
  isTest: false,
  reviewSandbox: false,
  bookingCount: 0,
  shopCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  emailVerified: false,
  hasPassword: true,
  pendingRole: null,
  isAnonymized: false,
  lastIp: "198.51.100.7",
};
let user: AdminUserDetail = GUEST;

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const mutations = () => mockCalls.filter((c) => c.body !== undefined);
const isDisabled = (name: string) => screen.getByRole("button", { name }).props.accessibilityState?.disabled === true;
const alertSpy = jest.spyOn(Alert, "alert");
beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  mockCalls.length = 0;
  mockParams = { id: "g1" };
  mockMyId = "admin-1";
  user = GUEST;
  alertSpy.mockReset();
  mockHandler = async (path) => {
    if (path === "/admin/users/g1") return { user };
    if (path.endsWith("/role")) return { ok: true, status: "applied" };
    return { ok: true };
  };
});

async function renderUser() {
  await render(<AdminUserScreen />, { wrapper });
  // Soguk onbellekte ilk cizim 1 sn'yi asabiliyor (varsayilan findBy suresi).
  await screen.findByText("İşlemler", undefined, { timeout: 8000 });
}

const CONVERT = { phone: "0555 111 22 33", shopName: "Kose", shopAddress: "Ornek Cad. 1", location: "41.01, 28.97" };

describe("kapilar (saf)", () => {
  it("kalici silme: kendisi ve anonim hesap degil; IP engeli: kayitli IP sart", () => {
    expect(canHardDelete(GUEST, "admin-1")).toBe(true);
    expect(canHardDelete(GUEST, "g1")).toBe(false);
    expect(canHardDelete({ ...GUEST, isAnonymized: true }, "admin-1")).toBe(false);
    // Yonetici once iki admin onayli rol akisiyla dusurulur.
    expect(canHardDelete({ ...GUEST, role: "ADMIN" }, "admin-1")).toBe(false);
    expect(canBlockIp(GUEST, "admin-1")).toBe(true);
    expect(canBlockIp({ ...GUEST, lastIp: null }, "admin-1")).toBe(false);
    expect(canBlockIp(GUEST, "g1")).toBe(false);
  });

  it("esnafa cevirme yalniz aktif misafirde; form sunucu semasinin alt sinirlarini tasir", () => {
    expect(canConvertToPartner(GUEST)).toBe(true);
    expect(canConvertToPartner({ ...GUEST, role: "PARTNER" })).toBe(false);
    expect(canConvertToPartner({ ...GUEST, isBanned: true })).toBe(false);
    expect(isConvertFormValid(CONVERT)).toBe(true);
    expect(isConvertFormValid({ ...CONVERT, phone: "12345" })).toBe(false);
    expect(isConvertFormValid({ ...CONVERT, shopAddress: "kisa" })).toBe(false);
    expect(isConvertFormValid({ ...CONVERT, location: "" })).toBe(false);
  });

  it("bos suzgec sorguya girmez; dolu olanlar web adlariyla gider", () => {
    expect(adminUserListParams("", NO_USER_FILTERS).toString()).toBe("");
    expect(adminUserListParams(" ada ", { role: "PARTNER", status: "BANNED", type: "TEST" }, "c1").toString()).toBe(
      "q=ada&role=PARTNER&status=BANNED&type=TEST&cursor=c1",
    );
    expect(adminMessageParams(DEFAULT_MESSAGE_FILTERS).toString()).toBe("paged=1&category=SUPPORT");
    expect(adminMessageParams({ unreadOnly: true, category: null, q: " iade " }, "c2").toString()).toBe(
      "paged=1&unread=1&q=iade&cursor=c2",
    );
  });

  it("basvuru aramasi: ad, il/ilce, sahip, e-posta ve 0'li telefon", () => {
    const app = (over: Partial<AdminApplication>): AdminApplication => ({
      id: "a",
      name: "Kose Bakkal",
      address: "Ornek Cad. 1",
      city: "İstanbul",
      district: "Kadıköy",
      hasCoordinates: true,
      pricePerDay: 100,
      capacity: 5,
      createdAt: "2026-01-01T00:00:00.000Z",
      owner: { name: "Ali Veli", phone: "5321112233", email: "ali@example.com" },
      ...over,
    });
    const items = [app({ id: "a" }), app({ id: "b", name: "Liman Kafe", district: "Beşiktaş", owner: { name: "Ece", phone: "5449998877", email: null } })];
    expect(searchApplications(items, "").map((a) => a.id)).toEqual(["a", "b"]);
    expect(searchApplications(items, "kadikoy").map((a) => a.id)).toEqual(["a"]);
    expect(searchApplications(items, "ALI").map((a) => a.id)).toEqual(["a"]);
    expect(searchApplications(items, "0544 999").map((a) => a.id)).toEqual(["b"]);
    expect(searchApplications(items, "yok-boyle")).toEqual([]);
  });
});

describe("kullanici karti: yikici islemler", () => {
  it("kalici silme gerekce girilmeden acilmaz ve DELETE ucuna gerekceyle gider", async () => {
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Hesabı ve tüm kayıtlarını sil" }));
    await screen.findByRole("button", { name: "Tamamen sil" });
    expect(isDisabled("Tamamen sil")).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Gerekçe"), "ok");
    expect(isDisabled("Tamamen sil")).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Gerekçe"), "Sahte hesap");
    await fireEvent.press(screen.getByRole("button", { name: "Tamamen sil" }));
    await waitFor(() => expect(mutations()).toEqual([{ path: "/admin/users/g1", body: { reason: "Sahte hesap" } }]));
  });

  it("IP isareti son IP'yi gosterir, trafigi engellemedigini soyler, gerekceyle block-ip ucuna gider; sunucu reddi panelde cevrilir", async () => {
    mockHandler = async (path) => {
      if (path === "/admin/users/g1") return { user };
      if (path.endsWith("/block-ip")) throw new ApiError(409, "own_ip");
      return { ok: true };
    };
    await renderUser();
    expect(screen.getByText("Son IP: 198.51.100.7")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "IP'yi işaretle (yalnız kayıt)" }));
    await fireEvent.changeText(await screen.findByLabelText("Gerekçe"), "Spam basvuru");
    expect(screen.getByText(/trafiği engellemez/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "İşaretle" }));
    expect(await screen.findByText(/kullandığınız IP adresini işaretleyemezsiniz/)).toBeTruthy();
    expect(mutations()).toEqual([{ path: "/admin/users/g1/block-ip", body: { reason: "Spam basvuru" } }]);
  });

  it("kendi kartinda silme ve IP engeli yok; esnafta 'esnafa cevir' yok", async () => {
    mockMyId = "g1";
    user = { ...GUEST, role: "PARTNER" };
    await renderUser();
    expect(screen.queryByRole("button", { name: "Hesabı ve tüm kayıtlarını sil" })).toBeNull();
    expect(screen.queryByRole("button", { name: "IP'yi işaretle (yalnız kayıt)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Esnafa çevir" })).toBeNull();
  });
});

describe("sunucu hata kodlari", () => {
  const CODES = [
    "cannot_delete_self",
    "target_is_admin",
    "has_payment_history",
    "has_active_booking",
    "blocked_by_relations",
    "no_ip",
    "invalid_ip",
    "own_ip",
    "not_found",
    "invalid_data",
    "location_required",
    "invalid_tr_phone",
    "phone_already_registered",
    "not_guest",
  ];
  it.each(["tr", "en", "de", "fr", "ja", "ru"])("%s: her kodun metni var", async (lng) => {
    await i18n.changeLanguage(lng);
    for (const code of CODES) {
      expect(i18n.exists(`adminParityD1.users.errors.${code}`)).toBe(true);
    }
    expect(i18n.exists("adminParityD1.leads.errors.not_found")).toBe(true);
    await i18n.changeLanguage("tr");
  });
});
