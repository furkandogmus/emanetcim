/**
 * Oturum yasam dongusu: acilista ag hatasi oturumu silmez, oturum sonu sebebini
 * soyler, cikis sunucuyu beklemez, goruntuleme verisi admin cihazinda kalmaz.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Mock } from "jest-mock";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("../google-auth", () => ({ forgetGoogleAccount: jest.fn(async () => undefined), pickGoogleIdToken: jest.fn() }));
jest.mock("../apple-auth", () => ({ pickAppleCredential: jest.fn() }));
jest.mock("../push", () => ({ forgetPushRegistration: jest.fn(), unregisterPush: jest.fn(async () => undefined) }));
jest.mock("../notify", () => ({ notify: jest.fn() }));
jest.mock("@tanstack/react-query", () => {
  // Uygulamadaki gibi sabit: her render'da yeni nesne acilis effect'ini yeniden calistirirdi.
  const client = { clear: jest.fn() };
  return { useQueryClient: () => client };
});

type AuthModule = typeof import("../auth");
type ApiModule = typeof import("../api");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fetchMock: Mock<(url: string, init?: RequestInit) => Promise<unknown>> = jest.fn();

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body };
}

const partner = {
  id: "p1",
  email: "p@example.test",
  name: "Esnaf",
  phone: null,
  role: "PARTNER" as const,
  avatarUrl: "data:image/png;base64,AAAA",
  emailVerified: true,
};

type Env = {
  store: Map<string, string>;
  SecureStore: { getItemAsync: Mock<(k: string) => Promise<string | null>> };
  notify: Mock<(t: string, b?: string) => void>;
  api: ApiModule;
  ctx: () => ReturnType<AuthModule["useAuth"]>;
  flush: () => Promise<void>;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  /** Her render'daki durum ve o anki bearer turu: "loading" gecisini gormek icin. */
  renders: string[];
};

/** Her test taze modul kaydi: api.ts token'lari ve React ayni izolasyonda. */
async function mount(seed: Record<string, string> = {}, opts: { unreadableSession?: boolean } = {}): Promise<Env> {
  let env!: Omit<Env, "ctx" | "flush" | "act" | "renders">;
  let React!: typeof import("react");
  let TR!: typeof import("react-test-renderer");
  let auth!: AuthModule;
  jest.isolateModules(() => {
    React = jest.requireActual<typeof import("react")>("react");
    TR = jest.requireActual<typeof import("react-test-renderer")>("react-test-renderer");
    auth = jest.requireActual<AuthModule>("../auth");
    const ss = jest.requireMock<Env["SecureStore"] & { __store: Map<string, string> }>("expo-secure-store");
    env = {
      store: ss.__store,
      SecureStore: ss,
      notify: jest.requireMock<{ notify: Env["notify"] }>("../notify").notify,
      api: jest.requireActual<ApiModule>("../api"),
    };
  });
  for (const [k, v] of Object.entries(seed)) env.store.set(k, v);
  if (opts.unreadableSession) {
    env.SecureStore.getItemAsync.mockImplementation(async (k: string) => {
      if (k === "bp.session") throw new Error("keystore");
      return env.store.get(k) ?? null;
    });
  }
  let value: ReturnType<AuthModule["useAuth"]> | null = null;
  const renders: string[] = [];
  function Probe() {
    value = auth.useAuth();
    const st = value.state;
    renders.push(`${st.status === "signedIn" ? st.user.role : st.status}|${env.api.isImpersonating()}`);
    return null;
  }
  const flush = async () => {
    for (let i = 0; i < 5; i++) await TR.act(async () => new Promise((r) => setTimeout(r, 0)));
  };
  await TR.act(async () => {
    TR.create(React.createElement(auth.AuthProvider, null, React.createElement(Probe)));
  });
  await flush();
  const act = async (fn: () => Promise<unknown>) => {
    await TR.act(async () => {
      await fn();
    });
    await flush();
  };
  return { ...env, ctx: () => value!, flush, act, renders };
}

const session = JSON.stringify({ accessToken: "a-1", refreshToken: "r-1" });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("AuthProvider acilis", () => {
  it("onbellekteki kullaniciyla hemen acilir; /auth/me ag hatasi oturumu silmez", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed") as never);
    const env = await mount({ "bp.session": session, "bp.user": JSON.stringify(partner) });
    expect(env.ctx().state).toMatchObject({ status: "signedIn", user: { id: "p1" } });
    expect(env.store.get("bp.session")).toBe(session);
  });

  it("onbellek yoksa ve sunucuya ulasilamazsa token'lar diskte kalir (sonraki acilis dener)", async () => {
    fetchMock.mockResolvedValue(json(503, { error: "service_unavailable" }) as never);
    const env = await mount({ "bp.session": session });
    expect(env.ctx().state.status).toBe("signedOut");
    expect(env.store.get("bp.session")).toBe(session);
  });

  it("anahtar deposu okunamazsa acilis ekraninda takili kalmaz", async () => {
    const env = await mount({ "bp.session": session }, { unreadableSession: true });
    expect(env.ctx().state.status).toBe("signedOut");
  });

  it("onbellege avatar yazilmaz (buyuk data URL SecureStore yazimini dusuruyordu)", async () => {
    fetchMock.mockResolvedValue(json(200, partner) as never);
    const env = await mount({ "bp.session": session });
    expect(env.ctx().state).toMatchObject({ status: "signedIn", user: { avatarUrl: partner.avatarUrl } });
    expect(JSON.parse(env.store.get("bp.user")!).avatarUrl).toBeNull();
  });
});

describe("oturum sonu", () => {
  it("esnafa sebebi rol uygun metinle soyler, biletleri ve onbellegi temizler, bir kez bildirir", async () => {
    fetchMock.mockResolvedValue(json(200, partner) as never);
    const env = await mount({
      "bp.session": session,
      offline_tickets: JSON.stringify(["b1"]),
      ticket_b1: "{}",
    });
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/refresh") ? json(401, { error: "unauthorized" }) : json(401, { error: "unauthorized" }),
    );
    await env.act(() =>
      Promise.all([env.api.api("/x").catch(() => undefined), env.api.api("/y").catch(() => undefined)]),
    );
    expect(env.ctx().state.status).toBe("signedOut");
    expect(env.notify).toHaveBeenCalledTimes(1);
    const i18n = jest.requireActual<typeof import("../i18n")>("../i18n").default;
    expect(env.notify).toHaveBeenCalledWith(
      i18n.t("auth.sessionExpiredTitle"),
      i18n.t("auth.sessionExpiredBodyStaff"),
    );
    expect(env.store.has("ticket_b1")).toBe(false);
    expect(env.store.has("bp.user")).toBe(false);
  });
});

describe("cikis", () => {
  it("yerel oturum sunucu yanitini beklemeden kapanir; cikis istegi yakalanan token'la gider", async () => {
    fetchMock.mockResolvedValue(json(200, partner) as never);
    const env = await mount({ "bp.session": session });
    let releaseLogout!: () => void;
    fetchMock.mockImplementation(
      (url: string) =>
        new Promise((resolve) => {
          if (url.endsWith("/auth/logout")) releaseLogout = () => resolve(json(200, { ok: true }));
          else resolve(json(200, {}));
        }),
    );
    await env.act(() => env.ctx().signOut());
    expect(env.ctx().state.status).toBe("signedOut");
    expect(env.store.has("bp.session")).toBe(false);
    const logout = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/auth/logout"));
    expect((logout?.[1]?.headers as Record<string, string>).Authorization).toBe("Bearer a-1");
    await env.act(async () => releaseLogout());
    expect(env.notify).not.toHaveBeenCalled();
  });
});

describe("yonetici goruntulemesi", () => {
  const admin = { ...partner, id: "a1", role: "ADMIN" as const, avatarUrl: null };

  it("yarim kalmis goruntulemenin bilet ve dukkan secimi acilista temizlenir", async () => {
    fetchMock.mockResolvedValue(json(200, admin) as never);
    const env = await mount({
      "bp.session": session,
      "bp.impersonating": "1",
      offline_tickets: JSON.stringify(["b1"]),
      ticket_b1: "{}",
      partner_shop: "s1",
    });
    expect(env.store.has("ticket_b1")).toBe(false);
    expect(env.store.has("partner_shop")).toBe(false);
    expect(env.store.has("bp.impersonating")).toBe(false);
  });

  it("giris ve cikista token degisimi eski ekranlar kapandiktan sonra olur; sure goreli kurulur", async () => {
    fetchMock.mockResolvedValue(json(200, admin) as never);
    const env = await mount({ "bp.session": session, "bp.user": JSON.stringify(admin) });
    // Her istekte o anki durum: token degisimi ekranlar `loading`deyken olmali.
    const seen: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      seen.push(`${url.replace(/^.*\/api\/mobile/, "")}|${env.ctx().state.status}|${env.api.isImpersonating()}`);
      if (url.includes("/impersonate")) {
        return json(200, {
          accessToken: "imp-1",
          expiresAt: "2000-01-01T00:00:00.000Z", // bilerek gecmis: cihaz saati kaymis gibi
          expiresInSeconds: 1800,
          user: { ...partner, avatarUrl: null },
        });
      }
      return json(200, admin);
    });
    env.renders.length = 0;
    // act icinde beklenirse kilitlenir: gecis, eski ekranlarin kapandigi render'i bekliyor.
    let startDone!: Promise<void>;
    await env.act(async () => {
      startDone = env.ctx().startImpersonation("p1");
    });
    await env.act(() => startDone);
    expect(env.ctx().state).toMatchObject({ status: "signedIn", user: { id: "p1" } });
    expect(env.api.isImpersonating()).toBe(true);
    expect(env.store.get("bp.impersonating")).toBe("1");
    // Admin ekranlari hedef token'iyla hic render edilmez: once loading, token sonra degisir.
    expect(env.renders).not.toContain("ADMIN|true");
    expect(env.renders.indexOf("loading|false")).toBeLessThan(env.renders.indexOf("PARTNER|true"));
    env.renders.length = 0;
    const ends = Date.parse(env.ctx().impersonating!.expiresAt);
    expect(ends - Date.now()).toBeGreaterThan(29 * 60 * 1000);

    // act icinde beklenirse kilitlenir: gecis, eski ekranlarin kapandigi render'i bekliyor.
    let stopDone!: Promise<void>;
    await env.act(async () => {
      stopDone = env.ctx().stopImpersonation();
    });
    await env.act(() => stopDone);
    expect(env.api.isImpersonating()).toBe(false);
    expect(env.ctx().state).toMatchObject({ status: "signedIn", user: { id: "a1" } });
    expect(env.store.has("bp.impersonating")).toBe(false);
    // Hedef ekranlari admin token'iyla hic render edilmez.
    expect(env.renders).not.toContain("PARTNER|false");
    expect(env.renders).toContain("loading|true");
    // Cikistaki /auth/me admin token'iyla, goruntuleme kapandiktan sonra gider.
    expect(seen.filter((x) => x.startsWith("/auth/me")).every((x) => x.endsWith("|false"))).toBe(true);
  });
});
