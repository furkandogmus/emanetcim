/**
 * Admin kullanici karti: rol degisikligi onaysiz gitmez, kendi hesabinda rol/silme
 * yok, silme dugmesi e-posta/telefon yazilmadan ve gerekce girilmeden acilmaz, sifre
 * belirleme ikinci onay ister, her sunucu hata kodunun ceviri metni var, denetim
 * kaydi oneki ve kullanici filtresi istege girer.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import AdminUserScreen from "@/app/(admin)/admin/user/[id]";
import AdminAuditLogScreen from "@/app/(admin)/admin/audit-log";
import { canErase, canSubmitErasure, erasureConfirmMatches, generatePassword } from "@/lib/admin-user-actions";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import i18n from "@/lib/i18n";
import type { AdminUserDetail } from "@/lib/types";

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
  bookingCount: 0,
  shopCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  emailVerified: false,
  hasPassword: true,
  pendingRole: null,
  isAnonymized: false,
};
let user: AdminUserDetail = GUEST;

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const mutations = () => mockCalls.filter((c) => c.body !== undefined);
const isDisabled = (name: string) => screen.getByRole("button", { name }).props.accessibilityState?.disabled === true;
const alertSpy = jest.spyOn(Alert, "alert");
/** Son Alert'teki dugmeye bas (onay penceresi). */
async function pressAlertButton(text: string) {
  const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as { text?: string; onPress?: () => void }[];
  const b = buttons.find((x) => x.text === text);
  if (!b?.onPress) throw new Error(`Alert dugmesi yok: ${text}`);
  await act(async () => b.onPress?.());
}

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

describe("onay kapilari (saf)", () => {
  it("onay metni e-posta (harf duyarsiz) ya da telefon (0/+90 farksiz) olmali", () => {
    expect(erasureConfirmMatches(" ADA@example.com ", GUEST)).toBe(true);
    expect(erasureConfirmMatches("0555 111 22 33", GUEST)).toBe(true);
    expect(erasureConfirmMatches("ada@example.co", GUEST)).toBe(false);
    expect(erasureConfirmMatches("", GUEST)).toBe(false);
  });

  it("gerekce en az 5 karakter", () => {
    expect(canSubmitErasure({ confirm: "ada@example.com", reason: " abcd " }, GUEST)).toBe(false);
    expect(canSubmitErasure({ confirm: "ada@example.com", reason: "abcde" }, GUEST)).toBe(true);
  });

  it("yalnizca baskasinin misafir hesabi silinebilir", () => {
    expect(canErase(GUEST, "admin-1")).toBe(true);
    expect(canErase(GUEST, "g1")).toBe(false);
    expect(canErase({ ...GUEST, role: "PARTNER" }, "admin-1")).toBe(false);
    expect(canErase({ ...GUEST, isAnonymized: true }, "admin-1")).toBe(false);
  });
});

describe("inceleme kum havuzu (test hesabi)", () => {
  const sw = () => screen.getByLabelText("Test hesabı");

  it("acmak onay ister; onaydan sonra PATCH { isTest: true } gider", async () => {
    await renderUser();
    await act(async () => fireEvent(sw(), "valueChange", true));
    expect(mutations()).toEqual([]);
    await pressAlertButton("Test hesabı yap");
    await waitFor(() => expect(mutations()).toEqual([{ path: "/admin/users/g1", body: { isTest: true } }]));
  });

  it("kapatmak onaysiz gider", async () => {
    user = { ...GUEST, isTest: true };
    await renderUser();
    await act(async () => fireEvent(sw(), "valueChange", false));
    await waitFor(() => expect(mutations()).toEqual([{ path: "/admin/users/g1", body: { isTest: false } }]));
    // Gorulen tek pencere sonuc bildirimi; onay penceresi acilmadi.
    expect(alertSpy.mock.calls.map((c) => c[0])).toEqual(["Hesap artık gerçek kullanıcı."]);
  });

  it("yonetici hesabinda anahtar yok", async () => {
    user = { ...GUEST, role: "ADMIN" };
    await renderUser();
    expect(screen.queryByLabelText("Test hesabı")).toBeNull();
  });
});

describe("rol degisikligi", () => {
  it("rol secmek istek gondermez; onay penceresinde onaylayinca gider", async () => {
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Rolü değiştir" }));
    await fireEvent.press(await screen.findByText("Esnaf"));
    expect(alertSpy).toHaveBeenCalled();
    expect(mutations()).toEqual([]);

    await pressAlertButton("Rolü değiştir");
    await waitFor(() => expect(mutations()).toEqual([{ path: "/admin/users/g1/role", body: { role: "PARTNER" } }]));
  });

  it("sunucu hata kodu cevrilir (son admin)", async () => {
    mockHandler = async (path) => {
      if (path === "/admin/users/g1") return { user: { ...user, role: "ADMIN" } };
      throw new ApiError(409, "cannot_demote_sole_admin");
    };
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Rolü değiştir" }));
    await fireEvent.press(await screen.findByText("Misafir"));
    await pressAlertButton("Rolü değiştir");
    await waitFor(() =>
      expect(alertSpy).toHaveBeenLastCalledWith("İşlem yapılamadı", "Sistemdeki son yönetici düşürülemez.", expect.anything()),
    );
  });

  it("kendi hesabinda rol ve silme yok", async () => {
    mockMyId = "g1";
    await renderUser();
    expect(screen.queryByRole("button", { name: "Rolü değiştir" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hesabı sil" })).toBeNull();
  });
});

describe("hesap silme", () => {
  it("dugme e-posta/telefon eslesmeden ve gerekce girilmeden acilmaz", async () => {
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Hesabı sil" }));
    const submit = "Hesabı kalıcı olarak sil";
    await screen.findByRole("button", { name: submit });
    expect(isDisabled(submit)).toBe(true);

    await fireEvent.changeText(screen.getByLabelText("Silme gerekçesi"), "Kullanıcı istedi");
    await fireEvent.changeText(screen.getByLabelText("Onaylamak için e-postayı ya da telefonu yaz"), "baska@example.com");
    expect(isDisabled(submit)).toBe(true);

    await fireEvent.changeText(screen.getByLabelText("Onaylamak için e-postayı ya da telefonu yaz"), "ada@example.com");
    expect(isDisabled(submit)).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: submit }));
    await waitFor(() =>
      expect(mutations()).toEqual([
        { path: "/admin/users/g1/anonymize", body: { confirm: "ada@example.com", reason: "Kullanıcı istedi" } },
      ]),
    );
  });

  it("onay alaninin ipucu hesabin e-postasi/telefonu degil", async () => {
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Hesabı sil" }));
    const field = await screen.findByLabelText("Onaylamak için e-postayı ya da telefonu yaz");
    expect(field.props.placeholder).toBe("E-posta ya da telefonu yazın");
    expect(screen.queryByPlaceholderText(GUEST.email)).toBeNull();
    expect(screen.queryByPlaceholderText(GUEST.phone)).toBeNull();
  });

  it("anonim hesapta silme, sifirlama, dogrulama ve sifre islemleri yok", async () => {
    user = { ...GUEST, email: "gdpr_abc@invalid.local", phone: "", name: "", isAnonymized: true };
    await renderUser();
    for (const name of [
      "Hesabı sil",
      "Şifre sıfırlama e-postası gönder",
      "Doğrulama e-postasını yeniden gönder",
      "Şifre belirle",
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByText(/Bu hesap silinmiş/)).toBeTruthy();
    expect(screen.queryByText("gdpr_abc@invalid.local")).toBeNull();
  });

  it("esnaf hesabinda silme dugmesi yok, nedeni yazar", async () => {
    user = { ...GUEST, role: "PARTNER" };
    await renderUser();
    expect(screen.queryByRole("button", { name: "Hesabı sil" })).toBeNull();
    expect(screen.getByText("Esnaf ve yönetici hesapları buradan silinemez.")).toBeTruthy();
  });

  it("sunucu reddi panelin icinde cevrilir (aktif rezervasyon)", async () => {
    mockHandler = async (path) => {
      if (path === "/admin/users/g1") return { user };
      throw new ApiError(409, "active_bookings");
    };
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Hesabı sil" }));
    await fireEvent.changeText(await screen.findByLabelText("Silme gerekçesi"), "Kullanıcı istedi");
    await fireEvent.changeText(screen.getByLabelText("Onaylamak için e-postayı ya da telefonu yaz"), "5551112233");
    await fireEvent.press(screen.getByRole("button", { name: "Hesabı kalıcı olarak sil" }));
    expect(await screen.findByText(/aktif rezervasyonu var/)).toBeTruthy();
  });
});

describe("e-posta ve sifre", () => {
  it("sifirlama e-postasi onaysiz gitmez", async () => {
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Şifre sıfırlama e-postası gönder" }));
    expect(mutations()).toEqual([]);
    await pressAlertButton("Gönder");
    await waitFor(() => expect(mutations().map((c) => c.path)).toEqual(["/admin/users/g1/password-reset"]));
  });

  it("sifre belirleme ikinci onay ister", async () => {
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Şifre belirle" }));
    await fireEvent.changeText(await screen.findByLabelText("Yeni şifre"), "Yeni-sifre9");
    await fireEvent.press(screen.getByRole("button", { name: "Şifreyi kaydet" }));
    expect(mutations()).toEqual([]);
    await pressAlertButton("Şifreyi kaydet");
    await waitFor(() => expect(mutations()).toEqual([{ path: "/admin/users/g1/password", body: { password: "Yeni-sifre9" } }]));
    expect(await screen.findByText("Yeni-sifre9")).toBeTruthy();
  });

  it("e-postasi olmayan hesapta e-posta islemleri yok", async () => {
    user = { ...GUEST, email: "" };
    await renderUser();
    expect(screen.queryByRole("button", { name: "Şifre sıfırlama e-postası gönder" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Doğrulama e-postasını yeniden gönder" })).toBeNull();
  });
});

describe("sifre onerisi yalnizca guvenli rastgelelikle", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const setCrypto = (value: unknown) => Object.defineProperty(globalThis, "crypto", { value, configurable: true });
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, "crypto", original);
  });

  it("getRandomValues varsa ondan uretir, Math.random'a dokunmaz", () => {
    const random = jest.spyOn(Math, "random");
    let n = 0;
    setCrypto({ getRandomValues: (a: Uint32Array) => a.map(() => n++) });
    const pw = generatePassword();
    expect(pw).toHaveLength(10);
    expect(pw).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("guvenli kaynak yoksa uretmez", () => {
    const random = jest.spyOn(Math, "random");
    setCrypto(undefined);
    expect(generatePassword()).toBeNull();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it("kaynak yoksa alan bos acilir, oneri dugmesi yok, sifre yazilmadan kaydedilmez", async () => {
    setCrypto(undefined);
    await renderUser();
    await fireEvent.press(screen.getByRole("button", { name: "Şifre belirle" }));
    const field = await screen.findByLabelText("Yeni şifre");
    expect(field.props.value).toBe("");
    expect(screen.queryByRole("button", { name: "Yeni öner" })).toBeNull();
    expect(isDisabled("Şifreyi kaydet")).toBe(true);
    await fireEvent.changeText(field, "Yeni-sifre9");
    expect(isDisabled("Şifreyi kaydet")).toBe(false);
  });
});

describe("hata metinleri", () => {
  it.each([
    "forbidden",
    "not_allowed_while_impersonating",
    "invalid_data",
    "not_found",
    "cannot_change_self",
    "same_role",
    "pending_exists",
    "cannot_demote_sole_admin",
    "no_email",
    "invalid_email",
    "already_verified",
    "too_many_requests",
    "invalid_password",
    "forbidden_target",
    "cannot_delete_self",
    "already_anonymized",
    "invalid_reason",
    "confirm_mismatch",
    "not_guest",
    "active_bookings",
  ])("%s genel hataya dusmez", (code) => {
    const msg = errorMessage(new ApiError(409, code), "adminUsers");
    expect(msg).not.toBe(i18n.t("common.genericError"));
    expect(msg).not.toContain(code);
  });
});

describe("denetim kaydi", () => {
  beforeEach(() => {
    mockHandler = async (path) => {
      if (path.startsWith("/admin/audit-log")) {
        return {
          entries: [
            {
              id: "a1",
              action: "user.role_update",
              actorRole: "ADMIN",
              actorUserId: "admin-1",
              actorLabel: "Boss",
              entityType: "User",
              entityId: "g1",
              metadata: '{"newRole":"PARTNER"}',
              createdAt: "2026-11-20T10:00:00.000Z",
            },
          ],
          nextCursor: null,
          // Sunucu gibi: onekler yalnizca suzulmemis ilk sayfada.
          ...(/[?&](cursor|action|userId)=/.test(path) ? {} : { prefixes: ["user.", "shop."] }),
        };
      }
      return {};
    };
  });

  it("kullanici filtresi istege girer", async () => {
    mockParams = { userId: "g1", name: "Ada" };
    await render(<AdminAuditLogScreen />, { wrapper });
    expect(await screen.findByText("user.role_update")).toBeTruthy();
    expect(mockCalls[0].path).toBe("/admin/audit-log?userId=g1");
    expect(screen.getByText("Yalnızca: Ada")).toBeTruthy();
  });

  it("secilen onek istege girer, cipler suzulu yanitta kaybolmaz", async () => {
    mockParams = {};
    await render(<AdminAuditLogScreen />, { wrapper });
    await fireEvent.press(await screen.findByRole("button", { name: "shop" }));
    await waitFor(() => expect(mockCalls.at(-1)?.path).toBe("/admin/audit-log?action=shop."));
    expect(screen.getByRole("button", { name: "user" })).toBeTruthy();
  });
});
