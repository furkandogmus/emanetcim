import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

/**
 * Yonetici duyurusu: hedef kitle, dil secimi, 10 dakika siniri, test gonderiminin
 * kapsami, goruntuleme yasagi, gerekce, arka plan sayaclari ve asili satir temizligi.
 */
const { mockPrisma, mockRequireMobileUser, mockAudit, mockExpo, mockRateLimit } = vi.hoisted(() => {
  const mockPrisma = {
    user: { count: vi.fn(), findMany: vi.fn() },
    mobilePushToken: { count: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    broadcast: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notificationLog: { create: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  return { mockPrisma, mockRequireMobileUser: vi.fn(), mockAudit: vi.fn(), mockExpo: vi.fn(), mockRateLimit: vi.fn() };
});
vi.mock("@/lib/db", () => ({ default: mockPrisma }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: mockAudit }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/expo-push", async (orig) => ({
  ...(await orig<typeof import("@/lib/expo-push")>()),
  sendExpoPush: mockExpo,
}));
vi.mock("@/lib/mobile-auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/mobile-auth")>()),
  requireMobileUser: mockRequireMobileUser,
}));

import { notificationService } from "@/services/NotificationService";
import {
  audienceUserWhere,
  createBroadcast,
  deliverBroadcast,
  listBroadcasts,
  sendBroadcastTest,
} from "@/services/BroadcastService";
import { parseBroadcastContent, pickBroadcastText } from "@/lib/broadcast";
import * as rootRoute from "@/app/api/mobile/admin/broadcasts/route";
import * as previewMod from "@/app/api/mobile/admin/broadcasts/preview/route";
import * as testMod from "@/app/api/mobile/admin/broadcasts/test/route";

// Uc donus tipi `NextResponse | undefined` cikarsaniyor (requireMobileUser birligi); testte hep yanit var.
const sendRoute = async (r: NextRequest) => (await rootRoute.POST(r))!;
const listRoute = async (r: NextRequest) => (await rootRoute.GET(r))!;
const previewRoute = async (r: NextRequest) => (await previewMod.POST(r))!;
const testRoute = async (r: NextRequest) => (await testMod.POST(r))!;

/* ---------- hedef kitle: `where` nesnesini SQL anlamiyla degerlendiren kucuk yorumlayici ---------- */

type Row = { role: string; isBanned: boolean; email: string | null; tokens: number };
type Tri = boolean | null; // SQL uc degerli mantik: NULL karsilastirmasi null doner

function evalWhere(w: Prisma.UserWhereInput, u: Row): Tri {
  const parts: Tri[] = [];
  for (const [k, v] of Object.entries(w)) {
    if (k === "role") {
      parts.push(typeof v === "string" ? u.role === v : (v as { in: string[] }).in.includes(u.role));
    } else if (k === "isBanned") parts.push(u.isBanned === v);
    else if (k === "email") {
      if (v === null) parts.push(u.email === null);
      else {
        const f = v as { endsWith: string };
        parts.push(u.email === null ? null : u.email.endsWith(f.endsWith));
      }
    } else if (k === "OR") {
      const r = (v as Prisma.UserWhereInput[]).map((x) => evalWhere(x, u));
      parts.push(r.includes(true) ? true : r.includes(null) ? null : false);
    } else if (k === "NOT") {
      const r = evalWhere(v as Prisma.UserWhereInput, u);
      parts.push(r === null ? null : !r);
    } else if (k === "mobilePushTokens") parts.push(u.tokens > 0);
    else throw new Error(`yorumlayici bilmiyor: ${k}`);
  }
  return parts.includes(false) ? false : parts.includes(null) ? null : true;
}

const USERS: Record<string, Row> = {
  partner: { role: "PARTNER", isBanned: false, email: "esnaf@x.com", tokens: 1 },
  guest: { role: "GUEST", isBanned: false, email: "misafir@x.com", tokens: 2 },
  phoneGuest: { role: "GUEST", isBanned: false, email: null, tokens: 1 },
  admin: { role: "ADMIN", isBanned: false, email: "admin@x.com", tokens: 1 },
  bannedGuest: { role: "GUEST", isBanned: true, email: "kotu@x.com", tokens: 1 },
  anonymised: { role: "GUEST", isBanned: false, email: "gdpr_abc@invalid.local", tokens: 1 },
  noDevice: { role: "PARTNER", isBanned: false, email: "cihazsiz@x.com", tokens: 0 },
};
const pick = (a: "PARTNERS" | "GUESTS" | "ALL") =>
  Object.entries(USERS)
    .filter(([, u]) => evalWhere(audienceUserWhere(a), u) === true)
    .map(([k]) => k)
    .sort();

describe("hedef kitle", () => {
  it("PARTNERS yalniz cihazli, yasaksiz, silinmemis esnaflar", () => {
    expect(pick("PARTNERS")).toEqual(["partner"]);
  });
  it("GUESTS: telefonla kayitli (e-postasiz) misafir dahil; yasakli/anonim disarida", () => {
    expect(pick("GUESTS")).toEqual(["guest", "phoneGuest"]);
  });
  it("ALL ikisini birden alir, yonetici HIC girmez", () => {
    expect(pick("ALL")).toEqual(["guest", "partner", "phoneGuest"]);
  });
});

/* ---------- icerik ve dil ---------- */

const TR = { titleTr: "Bakim", bodyTr: "Bu gece 02:00-03:00 bakim var." };
const EN = { titleEn: "Maintenance", bodyEn: "Maintenance tonight 02:00-03:00." };

describe("icerik dogrulama", () => {
  it("TR baslik 1-60, govde 1-180 kod noktasi", () => {
    expect(parseBroadcastContent({ ...TR, titleTr: "  " })).toEqual({ ok: false, error: "invalid_title" });
    expect(parseBroadcastContent({ ...TR, titleTr: "a".repeat(61) })).toEqual({ ok: false, error: "invalid_title" });
    expect(parseBroadcastContent({ ...TR, titleTr: "😀".repeat(60) }).ok).toBe(true);
    expect(parseBroadcastContent({ ...TR, bodyTr: "" })).toEqual({ ok: false, error: "invalid_body" });
    expect(parseBroadcastContent({ ...TR, bodyTr: "b".repeat(181) })).toEqual({ ok: false, error: "invalid_body" });
  });
  it("yarim Ingilizce reddedilir, bos Ingilizce null olur", () => {
    expect(parseBroadcastContent({ ...TR, titleEn: "Only title" })).toEqual({ ok: false, error: "invalid_body" });
    const r = parseBroadcastContent({ ...TR, titleEn: " ", bodyEn: "" });
    expect(r.ok && r.content.titleEn).toBe(null);
  });
});

describe("dil secimi", () => {
  const both = { ...TR, ...EN };
  const trOnly = { ...TR, titleEn: null, bodyEn: null };
  it("tr ya da bilinmeyen cihaz Turkce alir", () => {
    expect(pickBroadcastText(both, "tr").lang).toBe("tr");
    expect(pickBroadcastText(both, null).lang).toBe("tr");
    expect(pickBroadcastText(both, "").lang).toBe("tr");
  });
  it("Turkce olmayan cihaz Ingilizce alir; Ingilizce yoksa Turkceye duser", () => {
    expect(pickBroadcastText(both, "en")).toEqual({ lang: "en", title: "Maintenance", body: EN.bodyEn });
    expect(pickBroadcastText(both, "de").lang).toBe("en");
    expect(pickBroadcastText(trOnly, "en")).toEqual({ lang: "tr", title: TR.titleTr, body: TR.bodyTr });
  });
});

/* ---------- uclar ve servis ---------- */

const ADMIN = { id: "a1", role: "ADMIN", email: "admin@x.com" };
const req = (path: string, body?: unknown, method = "POST") =>
  new NextRequest(`https://bagajpark.com/api/mobile/admin/broadcasts${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const NOW = new Date("2026-11-22T12:00:00Z");

type FakeRow = { status: string; createdAt: Date; updatedAt: Date };
/** `broadcast.findFirst`'u satir listesine karsi calistirir: hem "devam eden" hem "son kayit" sorgusu. */
function setRows(rows: FakeRow[]) {
  mockPrisma.broadcast.findFirst.mockImplementation(
    async (args: { where?: { status: { in: string[] }; updatedAt: { gte: Date } } }) => {
      if (args.where) {
        const w = args.where;
        return rows.find((r) => w.status.in.includes(r.status) && r.updatedAt >= w.updatedAt.gte) ?? null;
      }
      return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    },
  );
}
const ago = (min: number, base = NOW) => new Date(base.getTime() - min * 60_000);
const done = (min: number, base = NOW): FakeRow => ({ status: "DONE", createdAt: ago(min, base), updatedAt: ago(min, base) });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileUser.mockResolvedValue({ user: ADMIN });
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
  setRows([]);
  mockRateLimit.mockResolvedValue(true);
  mockPrisma.broadcast.create.mockResolvedValue({ id: "b1" });
  mockPrisma.broadcast.findUnique.mockResolvedValue(null);
  mockPrisma.broadcast.update.mockResolvedValue({});
  mockPrisma.broadcast.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.mobilePushToken.count.mockResolvedValue(3);
  mockPrisma.mobilePushToken.findMany.mockResolvedValue([]);
  mockPrisma.mobilePushToken.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.user.count.mockResolvedValue(2);
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockExpo.mockResolvedValue({ successCount: 0, staleTokens: [], failures: [] });
});

describe("yetki", () => {
  it("ADMIN olmayan 403 forbidden", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, role: "PARTNER" } });
    const res = await sendRoute(req("", { audience: "ALL", ...TR, reason: "bakim duyurusu" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });
  it("goruntuleme oturumunda dort uc da 403 forbidden ve hicbir sey gonderilmez", async () => {
    mockRequireMobileUser.mockResolvedValue({ user: { ...ADMIN, impersonatedBy: "a0" } });
    const spy = vi.spyOn(notificationService, "deliverMobilePush");
    for (const res of [
      await sendRoute(req("", { audience: "ALL", ...TR, reason: "bakim duyurusu" })),
      await testRoute(req("/test", TR)),
      await previewRoute(req("/preview", { audience: "ALL" })),
      await listRoute(req("", undefined, "GET")),
    ]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "forbidden" });
    }
    expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
  it("servis de goruntuleme aktorunu reddeder (ikinci tasiyici ayni kurali alir)", async () => {
    expect(await createBroadcast({ id: "a1", impersonatedBy: "a0" }, { audience: "ALL", ...TR, reason: "bakim" })).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect((await sendBroadcastTest({ id: "a1", impersonatedBy: "a0" }, TR)).ok).toBe(false);
  });
});

describe("POST /preview", () => {
  it("kisi ve cihaz sayisini ayni kitle filtresiyle sayar", async () => {
    const res = await previewRoute(req("/preview", { audience: "PARTNERS" }));
    expect(await res.json()).toEqual({ users: 2, devices: 3 });
    expect(mockPrisma.user.count.mock.calls[0][0].where).toEqual(audienceUserWhere("PARTNERS"));
    expect(mockPrisma.mobilePushToken.count.mock.calls[0][0].where).toEqual({ user: audienceUserWhere("PARTNERS") });
  });
  it("bilinmeyen kitle 400 invalid_audience", async () => {
    const res = await previewRoute(req("/preview", { audience: "ADMINS" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_audience" });
  });
});

describe("POST / (gercek gonderim)", () => {
  const body = { audience: "GUESTS", ...TR, reason: "planli bakim" };

  it("202 { id, devices }, kayit QUEUED ve denetim kaydi admin.broadcast.send", async () => {
    const res = await sendRoute(req("", body));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ id: "b1", devices: 3 });
    expect(mockPrisma.broadcast.create.mock.calls[0][0].data).toMatchObject({
      audience: "GUESTS",
      titleTr: TR.titleTr,
      reason: "planli bakim",
      createdById: "a1",
      targetedDevices: 3,
      status: "QUEUED",
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.broadcast.send", entityId: "b1", actorUserId: "a1" }),
    );
  });

  it("gerekce 5 karakterden kisaysa reason_required, kayit yok", async () => {
    const res = await sendRoute(req("", { ...body, reason: " abc " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "reason_required" });
    expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ audience: "X" }, "invalid_audience"],
    [{ titleTr: "" }, "invalid_title"],
    [{ bodyTr: "" }, "invalid_body"],
  ])("gecersiz govde %o -> %s", async (patch, code) => {
    const res = await sendRoute(req("", { ...body, ...patch }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: code });
  });

  it("10 dakika icinde ikinci duyuru 429 too_soon ve kalan saniye", async () => {
    setRows([done(3)]);
    const r = await createBroadcast({ id: "a1" }, body, { now: NOW });
    expect(r).toEqual({ ok: false, code: "too_soon", retryAfterSeconds: 420 });
    expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();
    // Kontrol kilit altinda yapiliyor.
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();

    setRows([done(1, new Date())]);
    const res = await sendRoute(req("", body));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "too_soon", retryAfterSeconds: expect.any(Number) });
  });

  it("10 dakika gectiyse yeniden gonderilebilir", async () => {
    setRows([done(10.02)]);
    expect((await createBroadcast({ id: "a1" }, body, { now: NOW })).ok).toBe(true);
  });

  it("ilerleyen QUEUED/SENDING varken 409 broadcast_in_progress (10 dakika gecmis olsa da)", async () => {
    setRows([{ status: "SENDING", createdAt: ago(25), updatedAt: ago(5) }]);
    expect(await createBroadcast({ id: "a1" }, body, { now: NOW })).toEqual({ ok: false, code: "broadcast_in_progress" });
    setRows([{ status: "QUEUED", createdAt: ago(12), updatedAt: ago(12) }]);
    expect(await createBroadcast({ id: "a1" }, body, { now: NOW })).toEqual({ ok: false, code: "broadcast_in_progress" });
    expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();

    setRows([{ status: "SENDING", createdAt: new Date(Date.now() - 20 * 60_000), updatedAt: new Date(Date.now() - 60_000) }]);
    const res = await sendRoute(req("", body));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "broadcast_in_progress" });
  });

  it("30 dakikadir ilerlemeyen (asili) satir yeni duyuruyu engellemez", async () => {
    setRows([{ status: "SENDING", createdAt: ago(45), updatedAt: ago(31) }]);
    expect((await createBroadcast({ id: "a1" }, body, { now: NOW })).ok).toBe(true);
  });

  it("gerekce 500 karakteri gecerse reason_too_long; sinirdaki deger kayda ve denetime ayni yazilir", async () => {
    expect(await createBroadcast({ id: "a1" }, { ...body, reason: "r".repeat(501) }, { now: NOW })).toEqual({
      ok: false,
      code: "reason_too_long",
    });
    expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();

    const reason = `  ${"r".repeat(500)}  `;
    expect((await createBroadcast({ id: "a1" }, { ...body, reason }, { now: NOW })).ok).toBe(true);
    const stored = mockPrisma.broadcast.create.mock.calls[0][0].data.reason;
    expect(stored).toBe("r".repeat(500));
    expect(mockAudit.mock.calls.at(-1)?.[0].metadata.reason).toBe(stored);
  });

  it("cihaz yoksa 400 no_recipients ve kayit yok", async () => {
    mockPrisma.mobilePushToken.count.mockResolvedValue(0);
    const res = await sendRoute(req("", body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_recipients" });
    expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();
  });
});

describe("POST /test (kendime gonder)", () => {
  it("yalniz cagiranin cihazlarina gider, kayit acmaz ve sinira bakmaz", async () => {
    mockPrisma.mobilePushToken.findMany.mockResolvedValue([
      { token: "ExponentPushToken[own1]", locale: "tr" },
      { token: "ExponentPushToken[own2]", locale: "en" },
    ]);
    mockExpo.mockImplementation(async (tokens: string[]) => ({ successCount: tokens.length, staleTokens: [], failures: [] }));
    const res = await testRoute(req("/test", { ...TR, ...EN }));
    expect(await res.json()).toEqual({ success: true, devices: 2 });
    expect(mockPrisma.mobilePushToken.findMany.mock.calls[0][0].where).toEqual({ userId: "a1" });
    const sentTokens = mockExpo.mock.calls.flatMap((c) => c[0] as string[]).sort();
    expect(sentTokens).toEqual(["ExponentPushToken[own1]", "ExponentPushToken[own2]"]);
    expect(mockPrisma.broadcast.create).not.toHaveBeenCalled();
    expect(mockPrisma.broadcast.findFirst).not.toHaveBeenCalled();
  });
  it("yonetici basina dakikada 5 ile sinirli: asilirsa 429 too_soon ve gonderim yok", async () => {
    mockPrisma.mobilePushToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[own1]", locale: "tr" }]);
    mockRateLimit.mockResolvedValue(false);
    const res = await testRoute(req("/test", TR));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too_soon", retryAfterSeconds: 60 });
    expect(mockRateLimit).toHaveBeenCalledWith("broadcast_test:a1", 5, 60_000);
    expect(mockExpo).not.toHaveBeenCalled();
  });

  it("cihazi olmayan yonetici icin devices 0 hata degil", async () => {
    const res = await testRoute(req("/test", TR));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, devices: 0 });
  });
});

describe("arka plan teslimi", () => {
  const ROW = {
    id: "b1",
    audience: "ALL",
    status: "QUEUED",
    ...TR,
    ...EN,
  };
  const devices = (n: number, locale: string, prefix: string) =>
    Array.from({ length: n }, (_, i) => ({ token: `ExponentPushToken[${prefix}${i}]`, locale }));

  it("dile gore gonderir, sayaclari parca parca artirir ve DONE ile bitirir", async () => {
    mockPrisma.broadcast.findUnique.mockResolvedValue(ROW);
    mockPrisma.mobilePushToken.findMany.mockResolvedValue([...devices(70, "tr", "t"), ...devices(30, "en", "e")]);
    mockExpo.mockImplementation(async (tokens: string[]) => ({
      successCount: tokens.length - 1,
      staleTokens: [tokens[0]],
      failures: [{ token: tokens[0], error: "DeviceNotRegistered" }],
    }));

    await deliverBroadcast("b1");

    expect(mockPrisma.broadcast.update.mock.calls[0][0].data).toMatchObject({ status: "SENDING", targetedDevices: 100 });
    // 70 TR -> 2 parca (50+20), 30 EN -> 1 parca; her parcada 1 olu token.
    const incs = mockPrisma.broadcast.update.mock.calls.slice(1).map((c) => c[0].data);
    expect(incs).toHaveLength(3);
    expect(incs.reduce((s, d) => s + d.sent.increment, 0)).toBe(97);
    expect(incs.reduce((s, d) => s + d.failed.increment, 0)).toBe(3);
    const enCall = mockExpo.mock.calls.find((c) => (c[0] as string[])[0].includes("[e"));
    expect(enCall?.[1]).toBe("Maintenance");
    expect(mockExpo.mock.calls.filter((c) => c[1] === TR.titleTr).flatMap((c) => c[0])).toHaveLength(70);
    // Gecersiz token sendPush ile ayni yoldan silinir.
    const deleted = mockPrisma.mobilePushToken.deleteMany.mock.calls.flatMap((c) => c[0].where.token.in);
    expect(deleted).toHaveLength(3);
    expect(mockPrisma.broadcast.updateMany.mock.calls.at(-1)?.[0]).toMatchObject({
      where: { id: "b1", status: "SENDING" },
      data: { status: "DONE" },
    });
  });

  it("bir parca firlatirsa digerleri devam eder, o parca basarisiz sayilir", async () => {
    mockPrisma.broadcast.findUnique.mockResolvedValue(ROW);
    mockPrisma.mobilePushToken.findMany.mockResolvedValue(devices(60, "tr", "t"));
    mockExpo
      .mockRejectedValueOnce(new Error("expo down"))
      .mockImplementation(async (tokens: string[]) => ({ successCount: tokens.length, staleTokens: [], failures: [] }));
    await deliverBroadcast("b1");
    const incs = mockPrisma.broadcast.update.mock.calls.slice(1).map((c) => c[0].data);
    expect(incs.reduce((s, d) => s + d.sent.increment, 0)).toBe(10);
    expect(incs.reduce((s, d) => s + d.failed.increment, 0)).toBe(50);
    expect(mockPrisma.broadcast.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("DONE");
  });

  it("hicbiri gitmezse FAILED", async () => {
    mockPrisma.broadcast.findUnique.mockResolvedValue(ROW);
    mockPrisma.mobilePushToken.findMany.mockResolvedValue(devices(2, "tr", "t"));
    mockExpo.mockResolvedValue({ successCount: 0, staleTokens: [], failures: [{ token: "x", error: "e" }, { token: "y", error: "e" }] });
    await deliverBroadcast("b1");
    expect(mockPrisma.broadcast.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("FAILED");
  });

  it("QUEUED olmayan satir ikinci kez gonderilmez", async () => {
    mockPrisma.broadcast.findUnique.mockResolvedValue({ ...ROW, status: "DONE" });
    mockPrisma.mobilePushToken.findMany.mockResolvedValue(devices(2, "tr", "t"));
    await deliverBroadcast("b1");
    expect(mockExpo).not.toHaveBeenCalled();
  });
});

describe("GET / (gecmis)", () => {
  it("30 dakikadir ilerlemeyen QUEUED/SENDING satiri FAILED'a ceker, sonra listeler", async () => {
    mockPrisma.broadcast.findMany.mockResolvedValue([
      {
        id: "b1",
        audience: "ALL",
        titleTr: "t",
        bodyTr: "b",
        status: "DONE",
        targetedDevices: 5,
        sent: 4,
        failed: 1,
        createdById: "a1",
        createdAt: NOW,
        finishedAt: NOW,
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: "a1", name: "Ayse", email: "a@x.com" }]);
    const rows = await listBroadcasts("20", NOW);
    const heal = mockPrisma.broadcast.updateMany.mock.calls[0][0];
    expect(heal.where.status).toEqual({ in: ["QUEUED", "SENDING"] });
    expect(heal.where.updatedAt.lt).toEqual(new Date(NOW.getTime() - 30 * 60_000));
    expect(heal.data.status).toBe("FAILED");
    expect(rows[0].createdByName).toBe("Ayse");

    const res = await listRoute(req("?limit=20", undefined, "GET"));
    expect(await res.json()).toEqual({
      items: [
        {
          id: "b1",
          audience: "ALL",
          titleTr: "t",
          bodyTr: "b",
          status: "DONE",
          targetedDevices: 5,
          sent: 4,
          failed: 1,
          createdAt: NOW.toISOString(),
          finishedAt: NOW.toISOString(),
          createdByName: "Ayse",
        },
      ],
    });
  });
});
