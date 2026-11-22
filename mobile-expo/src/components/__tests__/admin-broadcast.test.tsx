/**
 * Yonetici duyurusu: "Gonder" kitle + gecerli TR baslik/metin + gerekce olmadan acilmaz,
 * kitle degisince alici sayisi yeniden sorulur, onay penceresi kitleyi ve cihaz sayisini
 * tekrarlar, hata kodlari cevrilir (too_soon kalan dakikayi soyler), gecmis yalniz
 * ilerleyen gonderim varken yoklanir.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import AdminBroadcastScreen from "@/app/(admin)/admin/broadcast";
import { ApiError } from "@/lib/api";
import { broadcastErrorMessage, canSendBroadcast, EMPTY_BROADCAST_FORM } from "@/lib/broadcast";
import i18n from "@/lib/i18n";
import { openFromNotification } from "@/lib/push";
import { useAdminBroadcasts } from "@/lib/queries";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: {} }));
jest.mock("@/lib/auth", () => ({ useAuth: () => ({ state: { status: "signedIn", user: { id: "a1", role: "ADMIN" } } }) }));
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

const DEVICES = { PARTNERS: 12, GUESTS: 40, ALL: 52 } as const;

// Istemci test basina bir kez: sarmalayici her cizimde yeni istemci kurarsa sorgular sonsuza dek yeniden baslar.
let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const previewCalls = () => mockCalls.filter((c) => c.path === "/admin/broadcasts/preview");
const sendButton = () => screen.getByRole("button", { name: "Gönder" });
const isDisabled = (el: ReturnType<typeof sendButton>) => el.props.accessibilityState?.disabled === true;

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});

// gcTime sonsuz + temizlik: acik zamanlayici kalirsa jest surecten cikmaz.
afterEach(() => qc.clear());

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  mockCalls.length = 0;
  mockHandler = async (path, body) => {
    if (path === "/admin/broadcasts/preview") {
      const a = (body as { audience: keyof typeof DEVICES }).audience;
      return { users: DEVICES[a] - 2, devices: DEVICES[a] };
    }
    if (path.startsWith("/admin/broadcasts?")) return { items: [] };
    if (path === "/admin/broadcasts") return { id: "b1", devices: 12 };
    return {};
  };
});

async function fillValid({ audience = "Esnaflar", reason = "planli bakim" } = {}) {
  if (audience) await fireEvent.press(screen.getByText(audience));
  await fireEvent.changeText(screen.getByLabelText("Başlık (Türkçe)"), "Bakım");
  await fireEvent.changeText(screen.getByLabelText("Metin (Türkçe)"), "Bu gece 02:00-03:00 bakım var.");
  if (reason) await fireEvent.changeText(screen.getByLabelText("Gerekçe"), reason);
}

describe("gonderim kapisi", () => {
  it("kitle secilmeden Gonder kapali", async () => {
    await render(<AdminBroadcastScreen />, { wrapper });
    expect(isDisabled(sendButton())).toBe(true);
    await fillValid({ audience: "" });
    expect(isDisabled(sendButton())).toBe(true);
  });

  it("gerekce 5 karakterden kisayken kapali, tamamlaninca acik", async () => {
    await render(<AdminBroadcastScreen />, { wrapper });
    await fillValid({ reason: "abc" });
    await waitFor(() => expect(screen.getByTestId("broadcast-preview")).toHaveTextContent("12 cihaz", { exact: false }));
    expect(isDisabled(sendButton())).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Gerekçe"), "planli bakim");
    expect(isDisabled(sendButton())).toBe(false);
  });

  it("alici sayisi yuklenirken ya da alinamadiysa kapali", async () => {
    const base = mockHandler;
    mockHandler = (path, body) =>
      path === "/admin/broadcasts/preview" ? new Promise(() => undefined) : base(path, body);
    await render(<AdminBroadcastScreen />, { wrapper });
    await fillValid();
    expect(screen.getByTestId("broadcast-preview")).toHaveTextContent("Hesaplanıyor…");
    expect(isDisabled(sendButton())).toBe(true);
  });

  it("alici sayisi hata verdiyse kapali", async () => {
    const base = mockHandler;
    mockHandler = async (path, body) => {
      if (path === "/admin/broadcasts/preview") throw new ApiError(0, "network");
      return base(path, body);
    };
    await render(<AdminBroadcastScreen />, { wrapper });
    await fillValid();
    await waitFor(() => expect(screen.getByTestId("broadcast-preview")).toHaveTextContent("Alıcı sayısı alınamadı", { exact: false }));
    expect(isDisabled(sendButton())).toBe(true);
  });

  it("TR baslik ya da metin bossa kapali; yarim Ingilizce de kapatir", () => {
    const ok = { ...EMPTY_BROADCAST_FORM, audience: "ALL" as const, titleTr: "Bakım", bodyTr: "Metin", reason: "planli bakim" };
    expect(canSendBroadcast(ok)).toBe(true);
    expect(canSendBroadcast({ ...ok, titleTr: "  " })).toBe(false);
    expect(canSendBroadcast({ ...ok, bodyTr: "" })).toBe(false);
    expect(canSendBroadcast({ ...ok, titleTr: "a".repeat(61) })).toBe(false);
    expect(canSendBroadcast({ ...ok, titleEn: "Maintenance" })).toBe(false);
    expect(canSendBroadcast({ ...ok, titleEn: "Maintenance", bodyEn: "Tonight" })).toBe(true);
  });
});

describe("alici onizlemesi", () => {
  it("kitle secilmeden sorulmaz; kitle degisince yeni kitleyle yeniden sorulur", async () => {
    await render(<AdminBroadcastScreen />, { wrapper });
    expect(previewCalls()).toHaveLength(0);

    await fireEvent.press(screen.getByText("Esnaflar"));
    await waitFor(() => expect(screen.getByTestId("broadcast-preview")).toHaveTextContent("10 kişiye (12 cihaz) gidecek"));

    await fireEvent.press(screen.getByText("Herkes"));
    await waitFor(() => expect(screen.getByTestId("broadcast-preview")).toHaveTextContent("50 kişiye (52 cihaz) gidecek"));
    expect(previewCalls().map((c) => (c.body as { audience: string }).audience)).toEqual(["PARTNERS", "ALL"]);
  });
});

describe("onay penceresi", () => {
  it("kitleyi ve cihaz sayisini tekrarlar; onaylaninca gonderir ve basari durumuna gecer", async () => {
    await render(<AdminBroadcastScreen />, { wrapper });
    await fillValid({ audience: "Misafirler" });
    await waitFor(() => expect(screen.getByTestId("broadcast-preview")).toHaveTextContent("40 cihaz", { exact: false }));
    await fireEvent.press(sendButton());

    await waitFor(() =>
      expect(screen.getByTestId("broadcast-confirm")).toHaveTextContent("Misafirler · 40 cihaz", { exact: false }),
    );
    expect(mockCalls.some((c) => c.path === "/admin/broadcasts")).toBe(false);

    await fireEvent.press(screen.getByRole("button", { name: "Evet, gönder" }));
    await waitFor(() => expect(screen.getByText("Duyuru sıraya alındı")).toBeTruthy());
    expect(mockCalls.find((c) => c.path === "/admin/broadcasts")?.body).toEqual({
      audience: "GUESTS",
      titleTr: "Bakım",
      bodyTr: "Bu gece 02:00-03:00 bakım var.",
      reason: "planli bakim",
    });
  });

  it("onay acilinca alici sayisi yeniden sorulur; taze sayi gelene kadar onay kapali", async () => {
    let release: (v: unknown) => void = () => undefined;
    const base = mockHandler;
    mockHandler = (path, body) => {
      if (path === "/admin/broadcasts/preview" && previewCalls().length > 1) {
        return new Promise((resolve) => (release = resolve));
      }
      return base(path, body);
    };
    await render(<AdminBroadcastScreen />, { wrapper });
    await fillValid({ audience: "Misafirler" });
    await waitFor(() => expect(screen.getByTestId("broadcast-preview")).toHaveTextContent("40 cihaz", { exact: false }));
    await fireEvent.press(sendButton());

    expect(previewCalls()).toHaveLength(2);
    const confirm = screen.getByRole("button", { name: "Evet, gönder" });
    expect(isDisabled(confirm)).toBe(true);
    expect(screen.getByTestId("broadcast-confirm")).not.toHaveTextContent("40 cihaz", { exact: false });

    await act(async () => release({ users: 44, devices: 45 }));
    await waitFor(() =>
      expect(screen.getByTestId("broadcast-confirm")).toHaveTextContent("Misafirler · 45 cihaz", { exact: false }),
    );
    expect(isDisabled(screen.getByRole("button", { name: "Evet, gönder" }))).toBe(false);
  });

  it("yeni duyuruya baslarken onceki hata bandi temizlenir", async () => {
    let fail = true;
    const base = mockHandler;
    mockHandler = async (path, body) => {
      if (path === "/admin/broadcasts" && fail) throw new ApiError(400, "no_recipients");
      return base(path, body);
    };
    const confirmSend = async () => {
      await waitFor(() => expect(isDisabled(sendButton())).toBe(false));
      await fireEvent.press(sendButton());
      await waitFor(() => expect(isDisabled(screen.getByRole("button", { name: "Evet, gönder" }))).toBe(false));
      await fireEvent.press(screen.getByRole("button", { name: "Evet, gönder" }));
    };
    await render(<AdminBroadcastScreen />, { wrapper });
    await fillValid();
    await confirmSend();
    await waitFor(() => expect(screen.getByText("Bu kitlede bildirim alan cihaz yok.")).toBeTruthy());

    fail = false;
    await confirmSend();
    await waitFor(() => expect(screen.getByText("Duyuru sıraya alındı")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Yeni duyuru" }));
    expect(screen.queryByText("Bu kitlede bildirim alan cihaz yok.")).toBeNull();
  });

  it("sunucu too_soon donerse kalan dakikayla hata bandi gosterir", async () => {
    const base = mockHandler;
    mockHandler = async (path, body) => {
      if (path === "/admin/broadcasts") throw new ApiError(429, "too_soon", { error: "too_soon", retryAfterSeconds: 125 });
      return base(path, body);
    };
    await render(<AdminBroadcastScreen />, { wrapper });
    await fillValid();
    await waitFor(() => expect(isDisabled(sendButton())).toBe(false));
    await fireEvent.press(sendButton());
    await waitFor(() => expect(isDisabled(screen.getByRole("button", { name: "Evet, gönder" }))).toBe(false));
    await fireEvent.press(screen.getByRole("button", { name: "Evet, gönder" }));
    await waitFor(() => expect(screen.getByText("Az önce bir duyuru gönderildi. 3 dakika sonra tekrar dene.")).toBeTruthy());
  });
});

describe("hata metinleri", () => {
  it.each([
    ["invalid_audience", "Kime gideceğini seç."],
    ["invalid_title", "Başlık 1-60 karakter olmalı (İngilizce eklediysen onun da)."],
    ["invalid_body", "Metin 1-180 karakter olmalı (İngilizce eklediysen onun da)."],
    ["reason_required", "Gerekçe en az 5 karakter olmalı."],
    ["forbidden", "Bu işlem için yönetici olman gerekiyor; kullanıcı olarak görüntülerken yapılamaz."],
    ["no_recipients", "Bu kitlede bildirim alan cihaz yok."],
    ["broadcast_in_progress", "Önceki duyuru hâlâ gönderiliyor. Bitince yeniden dene; aşağıdaki listeden izleyebilirsin."],
    ["reason_too_long", "Gerekçe en fazla 500 karakter olabilir."],
  ])("%s cevrilir", (code, text) => {
    expect(broadcastErrorMessage(new ApiError(400, code))).toBe(text);
  });

  it("too_soon kalan saniyeyi dakikaya yukari yuvarlar", () => {
    expect(broadcastErrorMessage(new ApiError(429, "too_soon", { retryAfterSeconds: 61 }))).toContain("2 dakika");
    expect(broadcastErrorMessage(new ApiError(429, "too_soon", { retryAfterSeconds: 20 }))).toContain("1 dakika");
  });
});

describe("gecmis yoklamasi", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("QUEUED/SENDING varken yoklar, hepsi bitince durur", async () => {
    jest.useFakeTimers();
    const statuses = ["SENDING", "SENDING", "DONE"];
    let n = 0;
    mockHandler = async () => ({
      items: [{ id: "b1", status: statuses[Math.min(n++, statuses.length - 1)] }],
    });
    const listCalls = () => mockCalls.filter((c) => c.path.startsWith("/admin/broadcasts?")).length;

    const { result } = await renderHook(() => useAdminBroadcasts(), { wrapper });
    await waitFor(() => expect(result.current.data?.[0].status).toBe("SENDING"));
    expect(listCalls()).toBe(1);

    await act(async () => void jest.advanceTimersByTime(4100));
    await waitFor(() => expect(listCalls()).toBe(2));
    await act(async () => void jest.advanceTimersByTime(4100));
    await waitFor(() => expect(result.current.data?.[0].status).toBe("DONE"));
    expect(listCalls()).toBe(3);

    await act(async () => void jest.advanceTimersByTime(20_000));
    expect(listCalls()).toBe(3);
  });
});

describe("bildirime dokunma", () => {
  it("bookingId tasimayan duyuru hicbir yere yonlendirmez ve hata vermez", () => {
    const { router } = jest.requireMock<{ router: { push: jest.Mock } }>("expo-router");
    router.push.mockClear();
    const response = { notification: { request: { content: { data: {} } } } } as never;
    expect(() => openFromNotification(response, "PARTNER")).not.toThrow();
    expect(router.push).not.toHaveBeenCalled();
  });
});
