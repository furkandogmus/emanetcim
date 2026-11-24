/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * Ortak tarayici: web push aboneligi tarayiciya aittir. Cikista sunucudan silinir,
 * giriste yeni kullaniciya yeniden baglanir; yoksa A'nin bildirimleri B'nin ekranina duser.
 */

const m = vi.hoisted(() => ({
  signOut: vi.fn(),
  useSession: vi.fn(),
  auth: vi.fn(),
  prisma: { pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() } },
}));

vi.mock("next-auth/react", () => ({ signOut: m.signOut, useSession: m.useSession }));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ default: m.prisma }));

import { rebindBrowserPush, signOutWithPush, unbindBrowserPush } from "@/lib/web-push-client";
import WebPushSessionSync from "@/components/WebPushSessionSync";
import { POST, DELETE } from "@/app/api/push/subscribe/route";

const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "pk", auth: "ak" } };
const fetchMock = vi.fn();

function installSubscription(sub: typeof SUB | null) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => ({
        pushManager: { getSubscription: vi.fn(async () => (sub ? { toJSON: () => sub } : null)) },
      })),
    },
  });
}

const calls = () => fetchMock.mock.calls.map((c) => ({ method: c[1].method, body: JSON.parse(c[1].body) }));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue({ ok: true });
  installSubscription(SUB);
});

describe("istemci", () => {
  it("giriste mevcut abonelik yeniden POST edilir", async () => {
    await expect(rebindBrowserPush()).resolves.toBe(true);
    expect(calls()).toEqual([{ method: "POST", body: SUB }]);
  });

  it("abonelik yoksa istek atilmaz", async () => {
    installSubscription(null);
    await expect(rebindBrowserPush()).resolves.toBe(false);
    await expect(unbindBrowserPush()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cikista once abonelik silinir, sonra oturum kapanir", async () => {
    const order: string[] = [];
    fetchMock.mockImplementation(async () => {
      order.push("delete");
      return { ok: true };
    });
    m.signOut.mockImplementation(async () => {
      order.push("signOut");
    });
    await signOutWithPush({ redirectTo: "/login" });
    expect(calls()).toEqual([{ method: "DELETE", body: { endpoint: SUB.endpoint } }]);
    expect(order).toEqual(["delete", "signOut"]);
    expect(m.signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });

  it("silme basarisiz olsa da cikis yapilir", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await signOutWithPush();
    expect(m.signOut).toHaveBeenCalledTimes(1);
  });

  it("oturum acilinca (her rol) bir kez yeniden baglanir", async () => {
    m.useSession.mockReturnValue({ data: { user: { id: "u-b", role: "PARTNER" } }, status: "authenticated" });
    const { rerender } = render(<WebPushSessionSync />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    rerender(<WebPushSessionSync />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("oturum yokken baglama yapilmaz", () => {
    m.useSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<WebPushSessionSync />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sunucu /api/push/subscribe", () => {
  const req = (body: unknown) => ({ json: async () => body }) as never;

  it("POST ayni endpoint'i oturumdaki kullaniciya tasir", async () => {
    m.auth.mockResolvedValue({ user: { id: "user-b" } });
    const res = await POST(req(SUB));
    expect(res.status).toBe(200);
    expect(m.prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: SUB.endpoint },
      create: { userId: "user-b", endpoint: SUB.endpoint, p256dh: "pk", auth: "ak" },
      update: { userId: "user-b", p256dh: "pk", auth: "ak" },
    });
  });

  it("DELETE yalnizca oturum sahibinin satirini siler", async () => {
    m.auth.mockResolvedValue({ user: { id: "user-a" } });
    const res = await DELETE(req({ endpoint: SUB.endpoint }));
    expect(res.status).toBe(200);
    expect(m.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-a", endpoint: SUB.endpoint },
    });
  });

  it("oturumsuz istek 401", async () => {
    m.auth.mockResolvedValue(null);
    expect((await POST(req(SUB))).status).toBe(401);
    expect((await DELETE(req({ endpoint: SUB.endpoint }))).status).toBe(401);
  });
});
